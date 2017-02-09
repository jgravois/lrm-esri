var clientID = 'GflUDcee80ykvalv';
var accessToken;
var callbacks = [];
var protocol = window.location.protocol;
var callbackPage = protocol + '//johngravois.com/examples/oauth/callback.html';

var authPane = document.getElementById('auth');
var signInButton = document.getElementById('sign-in');

// this function will open a window and start the oauth process
function oauth(callback) {
  if(accessToken){
    callback(accessToken);
  } else {
    callbacks.push(callback);
    window.open('https://www.arcgis.com/sharing/oauth2/authorize?client_id='+clientID+'&response_type=token&expiration=20160&redirect_uri=' + window.encodeURIComponent(callbackPage), 'oauth', 'height=400,width=600,menubar=no,location=yes,resizable=yes,scrollbars=yes,status=yes');
  }
}

// this function will be called when the oauth process is complete
window.oauthCallback = function(token) {
  L.esri.get('https://www.arcgis.com/sharing/rest/portals/self', {
    token: token
  }, function(error, response){
    authPane.style.display = 'none';

    var control = L.Routing.control({
    	waypoints: [
    		L.latLng(57.74, 11.94),
    		L.latLng(57.6792, 11.949)
    	],
    	router: L.Routing.esri({
        liveTraffic: true,
        profile: 'Driving',
        token: token
      }),
    	geocoder: L.Control.Geocoder.nominatim(),
    	routeWhileDragging: true,
    	reverseWaypoints: true
    }).addTo(map);

    L.Routing.errorControl(control).addTo(map);
  });
};

signInButton.addEventListener('click', function(e){
  oauth();
  e.preventDefault();
});

var map = L.map('map');
L.esri.basemapLayer('Gray').addTo(map);
