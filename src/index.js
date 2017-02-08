var L = require('leaflet');
var EsriRouter = require('./esriRouter');

L.Routing = L.Routing || {};
L.routing = L.routing || {};

L.Routing.Esri = EsriRouter;

L.routing.esri = function(key, options) {
  return new EsriRouter(key, options);
}

// deprecate this later
L.Routing.esri = L.routing.esri;
