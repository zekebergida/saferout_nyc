


  function initMap() {
  var map = new google.maps.Map(document.getElementById('map'), {
    mapTypeControl: false,
    center: {lat: 40.7549, lng: -73.9840},
    zoom: 13
  });

  new AutocompleteDirectionsHandler(map);
}

/**
  * @constructor
 */
function AutocompleteDirectionsHandler(map) {
  this.map = map;
  this.originPlaceId = null;
  this.destinationPlaceId = null;
  this.travelMode = 'WALKING';
  var originInput = document.getElementById('origin-input');
  var destinationInput = document.getElementById('destination-input');
  var modeSelector = document.getElementById('mode-selector');
  this.directionsService = new google.maps.DirectionsService;
  this.directionsDisplay = new google.maps.DirectionsRenderer({
    draggable: true,
  });
  this.directionsDisplay.setMap(map);

  var originAutocomplete = new google.maps.places.Autocomplete(
    originInput, {placeIdOnly: true});
  var destinationAutocomplete = new google.maps.places.Autocomplete(
    destinationInput, {placeIdOnly: true});

  this.setupClickListener('changemode-walking', 'WALKING');
  this.setupClickListener('changemode-bicycling', 'BICYCLING');
  // this.setupClickListener('changemode-transit', 'TRANSIT');
  // this.setupClickListener('changemode-driving', 'DRIVING');

  this.setupPlaceChangedListener(originAutocomplete, 'ORIG');
  this.setupPlaceChangedListener(destinationAutocomplete, 'DEST');

  this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(originInput);
  this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(destinationInput);
  this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(modeSelector);
}

// Sets a listener on a radio button to change the filter type on Places
// Autocomplete.
AutocompleteDirectionsHandler.prototype.setupClickListener = function(id, mode) {
  var radioButton = document.getElementById(id);
  var me = this;
  radioButton.addEventListener('click', function() {
    me.travelMode = mode;
    me.route();
  });
};

AutocompleteDirectionsHandler.prototype.setupPlaceChangedListener = function(autocomplete, mode) {
  var me = this;
  autocomplete.bindTo('bounds', this.map);
  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (!place.place_id) {
      window.alert("Please select an option from the dropdown list.");
      return;
    }
    if (mode === 'ORIG') {
      me.originPlaceId = place.place_id;
    } else {
      me.destinationPlaceId = place.place_id;
    }
    me.route();
  });

};
var routes = [];
// getting directions
AutocompleteDirectionsHandler.prototype.route = function() {
  if (!this.originPlaceId || !this.destinationPlaceId) {
    return;
  }
  var me = this;
  
  this.directionsService.route({
    origin: {'placeId': this.originPlaceId},
    destination: {'placeId': this.destinationPlaceId},
    travelMode: this.travelMode,
    provideRouteAlternatives: true,
  }, function(response, status) {
    if (status === 'OK') {
      // first loop  to display all routes in the response  
      var polylineColors = ["red", "blue", "yellow"];
      for (var i = 0, len = response.routes.length; i < len; i++) {
        var route = new google.maps.DirectionsRenderer({
          map: this.map,
          directions: response,
          routeIndex: i,
          polylineOptions: {
            strokeColor: polylineColors[i],
            strokeOpacity: 0.5,
            strokeWeight: 6
          }
        });
        routes.push(route);
        route.collisionCount = 0;
        route.collisionMarkers = [];
        // create marker to label each route
        var middlePointOnOverviewPath = Math.floor(response.routes[i].overview_path.length / 2);
        var routeMarker = new google.maps.Marker({
          position: response.routes[i].overview_path[middlePointOnOverviewPath],
          map: this.map,
          label: (i + 1).toString()
        });
        route.routeMarker = routeMarker;
        // inner loop to iterate over points on overview_path of current rout and locate relevant collisions near each point
        for (var j = 0; j < response.routes[i].overview_path.length; j++) {
          (function(i) {
            // this query for collision locations is inaccurate because points on the overview path are not at a set distance from each other. Therefor finding collisions within a set radius of each point will result in some duplicates and some ommisions
            $.get("https://data.cityofnewyork.us/resource/qiz3-axqb.geojson?$where=within_circle(location, " + response.routes[i].overview_path[j].lat() + ", " + response.routes[i].overview_path[j].lng() + ", 15) AND (number_of_pedestrians_injured > 0 OR number_of_pedestrians_killed > 0 OR number_of_cyclist_injured > 0 OR number_of_cyclist_killed > 0)").then(function(result) {
              // third loop to create a marker for each collision in the response
              for (var k = 0; k < result.features.length; k++) {
                var coords = result.features[k].geometry.coordinates;
                var latLng = new google.maps.LatLng(coords[1],coords[0]);
                
                var marker = new google.maps.Marker({
                  position: latLng,
                  map: this.map,
                  icon: "assets/bang.png"
                }
                );
                routes[i].collisionMarkers.push(marker);
                routes[i].collisionCount += 1;
                // console.log(routes[i].collisionCount)
                console.log(i)
              }
            }.bind(this));
          }.bind(this))(i);  
        }
      }
      // 
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  }.bind(this));
};




// functions for control panel buttons
$("#btn_route_info").click( function(){
  getCollisionCount();
  distanceAndDuration();
  window.location.hash = '#control_panel'
  });

$("#btn_safest_route").click( function(){
  displaySafestRoute();
  window.location.hash = '#map'
});

$("#btn_reset_map").click( function(){
  resetMap()
});


function getIndexOfSafestRoute() {
  var indexOfSafestRoute = 0;
  var collisionCountOnSafestRoute = routes[0].collisionCount;
  for (var i = 1; i < routes.length; i++) {
    if (routes[i].collisionCount < collisionCountOnSafestRoute) {
      indexOfSafestRoute = i;
      collisionCountOnSafestRoute = routes[i].collisionCount
    }
  }
  return indexOfSafestRoute;
};

function displaySafestRoute() {
  var indexOfSafestRoute = getIndexOfSafestRoute();
  for (var i = 0; i < routes.length; i++) {
    if (i !== indexOfSafestRoute) { 
      console.log(routes[i]);
      routes[i].setMap(null);
      clearRouteMarkers(i);
    }
  }
};

function clearRouteMarkers(routeIndex) {
  routes[routeIndex].routeMarker.setMap(null)
  var collisionMarkers = routes[routeIndex].collisionMarkers;
  for (var i = 0; i < collisionMarkers.length; i++) {
    collisionMarkers[i].setMap(null);
  };
};

function distanceAndDuration() {
  console.log(routes[0].directions.routes);
  var routeDuration = document.getElementsByClassName("duration");
  var routeDistance = document.getElementsByClassName("distance");
  for (var i = 0; i < 3; i++) {
    if (i + 1 <= routes.length) {
      routeDuration[i].innerHTML = 'Duration: <span style="font-weight:700; color:navy;">' + routes[0].directions.routes[i].legs[0].duration.text + "</span>";
      routeDistance[i].innerHTML = 'Distance: <span style="font-weight:700; color:navy;">' + routes[0].directions.routes[i].legs[0].distance.text; + "</span>";
    }
  }
};

function getCollisionCount() {
  var collisionCount = document.getElementsByClassName("data");
  var header = document.getElementsByClassName("data_title");

  for (var i = 0; i < 3; i++) {
    if (i + 1 <= routes.length) {
      collisionCount[i].innerHTML = "" + routes[i].collisionCount + ""
      header[i].innerHTML = "Collisions on this route that injured or killed Pedestrians or Cyclists";
    } else {
      header[i].innerHTML = "No Additional Routes";
    }
  }
};

function resetMap() {
  location.reload();
  // clearMarkers();
  // for (var i = 0; i < routes.length; i++) { 
  //   routes[i].setMap(null);
  // }
  // markers = [];
  // routes = [];
  // routesCollisionCount = [];
}
// functions for control panel buttons end