


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
var polylineColors = ["red", "blue", "yellow"];
var markers = [];
var routes = [];
var routesCollisionCount = [];
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
        // create marker to label each route
        var middlePointOnOverviewPath = Math.floor(response.routes["" + i + ""].overview_path.length / 2);
        var routeMarker = new google.maps.Marker({
          position: response.routes[i].overview_path[middlePointOnOverviewPath],
          map: this.map,
          label: (i + 1).toString()
        });
        markers.push(routeMarker);
        routes.push(route);
        routesCollisionCount.push(0);
        // second loop to iterate over points on overview_path and locate relevant collisions near each point
        for (var n = 0; n < response.routes[i].overview_path.length; n++) {
          (function(i) {
            // this query for collision locations is inaccurate because points on the overview path are not at a set distance from each other. Therefor finding collisions within a set radius of each point will result in some duplicates and some ommisions
            $.get("https://data.cityofnewyork.us/resource/qiz3-axqb.geojson?$where=within_circle(location, " + response.routes[i].overview_path[n].lat() + ", " + response.routes[i].overview_path[n].lng() + ", 15) AND (number_of_pedestrians_injured > 0 OR number_of_pedestrians_killed > 0 OR number_of_cyclist_injured > 0 OR number_of_cyclist_killed > 0)").then(function(result) {
              // third loop to create a marker for each collision in the response
              for (var f = 0; f < result.features.length; f++) {
                var coords = result.features[f].geometry.coordinates;
                var latLng = new google.maps.LatLng(coords[1],coords[0]);
                
                var marker = new google.maps.Marker({
                  position: latLng,
                  map: this.map,
                  icon: "assets/bang.png"
                }
                );
                markers.push(marker);
                routesCollisionCount[i] += 1;
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
  clearMarkers();
  displaySafestRoute();
  window.location.hash = '#map'
});

$("#btn_reset_map").click( function(){
  resetMap()
});


function clearMarkers() {
  setMapForMarkers(null);
}
function setMapForMarkers(map) {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}



function getIndexOfSafestRoute(routesCollisionCount) {
  if (routesCollisionCount.length === 0) {
    return -1;
  }
  var lowestCollisionCount = routesCollisionCount[0];
  var indexOfSafestRoute = 0;
  for (var i = 1; i < routesCollisionCount.length; i++) {
    if (routesCollisionCount[i] < lowestCollisionCount) {
      indexOfSafestRoute = i;
      lowestCollisionCount = routesCollisionCount[i];
    }
  }
  return indexOfSafestRoute;
}
function displaySafestRoute() {
  var indexOfSafestRoute = getIndexOfSafestRoute(routesCollisionCount);
  for (var a = 0; a < routes.length; a++) {
    if (a !== indexOfSafestRoute) { 
      routes[a].setMap(null);
    }
  }
}
function distanceAndDuration() {
  console.log(routes[0].directions.routes);
  var time = document.getElementsByClassName("duration");
  var far = document.getElementsByClassName("distance");
  for (var q = 0; q < 3; q++) {
    if (q + 1 <= routesCollisionCount.length) {
      time[q].innerHTML = 'Duration: <span style="font-weight:700; color:navy;">' + routes[0].directions.routes[q].legs[0].duration.text + "</span>";
      far[q].innerHTML = 'Distance: <span style="font-weight:700; color:navy;">' + routes[0].directions.routes[q].legs[0].distance.text; + "</span>";
    }
  }
}
function getCollisionCount() {
  var d = document.getElementsByClassName("data");
  var dt = document.getElementsByClassName("data_title");

  for (var i = 0; i < d.length; i++) {
    if (i + 1 <= routesCollisionCount.length) {
      d[i].innerHTML = "" + routesCollisionCount[i] + ""
      dt[i].innerHTML = "Number of Pedestrians and Cyclists Injured or Killed on This Route";
    } else {
      dt[i].innerHTML = "No Additional Routes";
    }
  }
}
function resetMap() {
  location.reload();
  clearMarkers();
  for (var a = 0; a < routes.length; a++) { 
    routes[a].setMap(null);
  }
  markers = [];
  routes = [];
  routesCollisionCount = [];
}
// functions for control panel buttons end