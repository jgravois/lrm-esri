var map = L.map('map');

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	attribution: 'Powered by <a href="https://www.esri.com">Esri</a> | &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var control = L.Routing.control({
	waypoints: [
		L.latLng(57.74, 11.94),
		L.latLng(57.6792, 11.949)
	],
	router: L.Routing.esri({
    liveTraffic: true,
    profile: 'Driving Time'
  }),
	geocoder: L.Control.Geocoder.nominatim(),
	routeWhileDragging: true,
	reverseWaypoints: true
}).addTo(map);

L.Routing.errorControl(control).addTo(map);
