(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function corslite(url, callback, cors) {
    var sent = false;

    if (typeof window.XMLHttpRequest === 'undefined') {
        return callback(Error('Browser not supported'));
    }

    if (typeof cors === 'undefined') {
        var m = url.match(/^\s*https?:\/\/[^\/]*/);
        cors = m && (m[0] !== location.protocol + '//' + location.hostname +
                (location.port ? ':' + location.port : ''));
    }

    var x = new window.XMLHttpRequest();

    function isSuccessful(status) {
        return status >= 200 && status < 300 || status === 304;
    }

    if (cors && !('withCredentials' in x)) {
        // IE8-9
        x = new window.XDomainRequest();

        // Ensure callback is never called synchronously, i.e., before
        // x.send() returns (this has been observed in the wild).
        // See https://github.com/mapbox/mapbox.js/issues/472
        var original = callback;
        callback = function() {
            if (sent) {
                original.apply(this, arguments);
            } else {
                var that = this, args = arguments;
                setTimeout(function() {
                    original.apply(that, args);
                }, 0);
            }
        }
    }

    function loaded() {
        if (
            // XDomainRequest
            x.status === undefined ||
            // modern browsers
            isSuccessful(x.status)) callback.call(x, null, x);
        else callback.call(x, x, null);
    }

    // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
    // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
    if ('onload' in x) {
        x.onload = loaded;
    } else {
        x.onreadystatechange = function readystate() {
            if (x.readyState === 4) {
                loaded();
            }
        };
    }

    // Call the callback with the XMLHttpRequest object as an error and prevent
    // it from ever being called again by reassigning it to `noop`
    x.onerror = function error(evt) {
        // XDomainRequest provides no evt parameter
        callback.call(this, evt || true, null);
        callback = function() { };
    };

    // IE9 must have onprogress be set to a unique function.
    x.onprogress = function() { };

    x.ontimeout = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    x.onabort = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    // GET is the only supported HTTP Verb by XDomainRequest and is the
    // only one supported here.
    x.open('GET', url, true);

    // Send the request. Sending data is not supported.
    x.send(null);
    sent = true;

    return x;
}

if (typeof module !== 'undefined') module.exports = corslite;

},{}],2:[function(require,module,exports){
(function (global){
(function() {
	'use strict';

	var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
	var corslite = require('corslite');
  // to do: add POST
  // var request = require('xhr-request');

	// Ignore camelcase naming for this file, since OSRM's API uses
	// underscores.
	/* jshint camelcase: false */
  (typeof window !== "undefined" ? window['Routing'] : typeof global !== "undefined" ? global['Routing'] : null);

  var profiles = require('./profiles.js');
	/*
	 Works against Esri's hosted routing service that supports
   driving, trucking, walking
   live and estimated traffic
   up to 150 input stops
   stop reordering (optimization)
   localization
	*/
	module.exports = L.Class.extend({
    // to do: start rounding response geometry to 5 decimal places
    options: {
			// for now we're using a proxied url that makes it possible to route without a token
			serviceUrl: 'http://utility.arcgis.com/usrsvcs/appservices/rdcfU1A3eVNshs0d/rest/services/World/Route/NAServer/Route_World',
			timeout: 30 * 1000,
			routingOptions: {
				profile: 'Driving Time',
        liveTraffic: true
			}
		},

		initialize: function(options) {
			L.Util.setOptions(this, options);
			this._hints = {
				locations: {}
			};
		},

		route: function(waypoints, callback, context, options) {
			var timedOut = false,
				wps = [],
				url,
				timer,
				wp,
				i,
				xhr;

			options = L.extend({}, this.options.routingOptions, options);
			url = this.buildRouteUrl(waypoints, options);
			if (this.options.requestParameters) {
				url += L.Util.getParamString(this.options.requestParameters, url);
			}

			timer = setTimeout(function() {
				timedOut = true;
				callback.call(context || callback, {
					status: -1,
					message: 'request timed out.'
				});
			}, this.options.timeout);

			// Create a copy of the waypoints, since they
			// might otherwise be asynchronously modified while
			// the request is being processed.
			for (i = 0; i < waypoints.length; i++) {
				wp = waypoints[i];
				wps.push(L.Routing.waypoint(wp.latLng, wp.name, wp.options));
			}

      // return xhr = request(url, { method: 'POST', body: params }, L.bind(function(err, resp) {
			return xhr = corslite(url, L.bind(function(err, resp) {
				var data,
					error =  {};

				clearTimeout(timer);
				if (!timedOut) {
					if (!err) {
						try {
							data = JSON.parse(resp.responseText);
							try {
								return this._routeDone(data, wps, options, callback, context);
							} catch (ex) {
								error.status = -3;
								error.message = ex.toString();
							}
						} catch (ex) {
							error.status = -2;
							error.message = 'Error parsing response: ' + ex.toString();
						}
					} else {
						error.message = 'HTTP request failed: ' + err.type +
							(err.target && err.target.status ? ' HTTP ' + err.target.status + ': ' + err.target.statusText : '');
						error.url = url;
						error.status = -1;
						error.target = err;
					}

					callback.call(context || callback, error);
				} else {
					xhr.abort();
				}
			}, this));
		},

		requiresMoreDetail: function(route, zoom, bounds) {
			if (!route.properties.isSimplified) {
				return false;
			}

			var waypoints = route.inputWaypoints,
				i;
			for (i = 0; i < waypoints.length; ++i) {
				if (!bounds.contains(waypoints[i].latLng)) {
					return true;
				}
			}

			return false;
		},

		_routeDone: function(response, inputWaypoints, options, callback, context) {
			var alts = [],
			    actualWaypoints,
			    i,
			    route;

			context = context || callback;
			// no error message
			if (response.error && response.error.code == 400) {
				callback.call(context, {
					status: response.code
				});
				return;
			}

			actualWaypoints = this._esriToWaypoints(inputWaypoints, response.stops.features);

			// can the esri service pass back alternate routes? if so, add a loop
			route = this._convertRoute(response.directions[0]);

			route.summary = {
				totalDistance: response.directions[0].summary.totalLength,
				// seconds
				totalTime: response.directions[0].summary.totalTime * 60
			}

			// route.name = 'Routing with Esri\'s hosted service'
			response.routes.features[0]
			route.inputWaypoints = inputWaypoints;
			route.waypoints = actualWaypoints;
			// i have no idea what this does
			route.properties = {isSimplified: !options || !options.geometryOnly || options.simplifyGeometry};

			alts.push(route);
			this._saveHintData(inputWaypoints, inputWaypoints);
			callback.call(context, null, alts);
		},

		_convertRoute: function(responseRoute, summary) {
			var result = {
					coordinates: [],
					instructions: []
				},
				legNames = [],
				waypointIndices = [],
				index = 0,
        // i dont *think* the esri routing service supports alternate routes
        legCount = 1,
				hasSteps = responseRoute.features.length > 0,
				i,
				j,
				leg,
				step,
				geometry,
				type,
				modifier,
				text,
				stepToText;

			for (i = 0; i < legCount; i++) {
				leg = responseRoute.features;
				legNames.push(responseRoute.routeName);
				text = responseRoute.routeName;

				for (j = 0; j < leg.length; j++) {
					step = leg[j];
					geometry = this._esriDecodePolyline(step.compressedGeometry);
					result.coordinates.push.apply(result.coordinates, geometry);
					type = this._esriManeuverToInstructionType(step.attributes, i === legCount - 1);
					modifier = this._esriManeuverToModifier(step.attributes);

					text = step.attributes.text;

					if (step.attributes.maneuverType) {
						if ((i == 0 && step.attributes.maneuverType == 'esriDMTDepart') || step.attributes.maneuverType == 'esriDMTStop') {
							waypointIndices.push(index);
						}
          }

          result.instructions.push({
            type: type,
            distance: step.attributes.length,
            time: step.attributes.time,
            index: index,
            modifier: modifier,
            text: text
            // road: 'placeholder', // step.name,
            // direction: this._bearingToDirection(step.maneuver.bearing_after),
            // exit: step.maneuver.exit,
            // mode: step.mode,
          });

					index += geometry.length;
				}
			}

			result.name = legNames.join(', ');

			return result;
		},

		_bearingToDirection: function(bearing) {
			var oct = Math.round(bearing / 45) % 8;
			return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][oct];
		},

		_esriManeuverToInstructionType: function(attributes, lastLeg) {
			// case 'esriDMTStraight':
			// case 'esriDMTTurnLeft':
			// case 'esriDMTTurnRight':
			switch (attributes.maneuverType) {
			case 'esriDMTDepart':
				return 'Head';
			case 'esriDMTStop':
				return lastLeg ? 'DestinationReached' : 'WaypointReached';
			case 'esriDMTRoundabout':
			case 'rotary':
				return 'Roundabout';
			case 'esriDMTForkLeft':
			case 'esriDMTForkRight':
			case 'esriDMTRampLeft':
			case 'esriDMTRampRight':
			case 'esriDMTSharpLeft':
			case 'esriDMTSharpRight':
				return this._camelCase(attributes.maneuverType);
			default:
				return null
			}
		},

		_esriManeuverToModifier: function(attributes) {
			var modifier;

			switch (attributes.maneuverType) {
			case 'esriDMTDepart':
			case 'esriDMTStraight':
			case 'esriDMTRoundabout':
			case 'esriDMTStop':
			  modifier = null;
				break
			default:
			  modifier = this._leftOrRight(attributes.maneuverType);
			}
			return modifier && this._camelCase(modifier);
		},

		_camelCase: function(s) {
			var words = s.split(' '),
				result = '';
			for (var i = 0, l = words.length; i < l; i++) {
				result += words[i].charAt(0).toUpperCase() + words[i].substring(1);
			}

			return result;
		},

		_leftOrRight: function(d) {
			return d.indexOf('Left') >= 0 ? 'Left' : 'Right';
		},

    // https://github.com/Esri/terraformer-arcgis-parser/issues/10
    _esriDecodePolyline: function(str) {
    var xDiffPrev = 0,
        yDiffPrev = 0,
        points = [],
        x, y,
        strings,
        coefficient;

      // Split the string into an array on the + and - characters
      strings = str.match(/((\+|\-)[^\+\-]+)/g);

      // The first value is the coefficient in base 32
      coefficient = parseInt(strings[0], 32);

      for (var j = 1; j < strings.length; j += 2) {
        // j is the offset for the x value
        // Convert the value from base 32 and add the previous x value
        x = (parseInt(strings[j], 32) + xDiffPrev);
        xDiffPrev = x;

        // j+1 is the offset for the y value
        // Convert the value from base 32 and add the previous y value
        y = (parseInt(strings[j + 1], 32) + yDiffPrev);
        yDiffPrev = y;

        points.push(L.latLng([y / coefficient, x / coefficient]));
      }

      return points;
    },

    _esriToWaypoints: function(inputWaypoints, vias) {
			var wps = [],
			    i,
			    viaLoc;
			for (i = 0; i < vias.length; i++) {
				viaLoc = vias[i].geometry;
				wps.push(L.Routing.waypoint(L.latLng(viaLoc.y, viaLoc.x),
				                            inputWaypoints[i].name,
											inputWaypoints[i].options));
			}

			return wps;
		},

		buildRouteUrl: function(waypoints, options) {
			var locs = [],
				hints = [],
				wp,
				latLng,
			    computeInstructions,
			    computeAlternative = true;

			for (var i = 0; i < waypoints.length; i++) {
				wp = waypoints[i];
				latLng = wp.latLng;
				locs.push(latLng.lng + ',' + latLng.lat);
				hints.push(this._hints.locations[this._locationKey(latLng)] || '');
			}

			// computeInstructions = true;
      var completeServiceUrl = this.options.serviceUrl + '/solve?f=json&returnStops=true&directionsLengthUnits=esriNAUMeters&directionsOutputType=esriDOTComplete';

      if (this.options.liveTraffic) {
        completeServiceUrl += '&startTimeisUTC=true&startTime=' + new Date().getTime()
      }

      if (this.options.profile) {
        completeServiceUrl += '&travelMode=' + profiles[this.options.profile]
      }

      completeServiceUrl += '&stops=' + locs.join(';');

      return completeServiceUrl;

      // var params = {
      //   f: 'json',
      //   returnStops: true,
      //   directionsLengthUnits: 'esriNAUMeters',
      //   directionsOutputType: 'esriDOTComplete'
      // };
      //
      // if (this.options.liveTraffic) {
      //   params.startTimeisUTC = true
      //   params.startTime = new Date().getTime()
      // }
      //
      // params.travelMode = profiles[this.options.profile]
      // params.stops = locs.join(';');
      //
      // return params;
		},

		_locationKey: function(location) {
			return location.lat + ',' + location.lng;
		},

		_saveHintData: function(actualWaypoints, waypoints) {
			var loc;
			this._hints = {
				locations: {}
			};
			for (var i = actualWaypoints.length - 1; i >= 0; i--) {
				loc = waypoints[i].latLng;
				this._hints.locations[this._locationKey(loc)] = actualWaypoints[i].hint;
			}
		},
	});
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./profiles.js":4,"corslite":1}],3:[function(require,module,exports){
(function (global){
var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
var EsriRouter = require('./esriRouter');

L.Routing = L.Routing || {};
L.routing = L.routing || {};

L.Routing.Esri = EsriRouter;

L.routing.esri = function(key, options) {
  return new EsriRouter(key, options);
}

// deprecate this later
L.Routing.esri = L.routing.esri;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./esriRouter":2}],4:[function(require,module,exports){
module.exports = {
  "Driving Time" : '{"name":"Driving Time","itemId":"1","type":"AUTOMOBILE","description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"TravelTime","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"}',

  "Driving Distance" : '{"name":"Driving Distance","itemId":"2","type":"AUTOMOBILE","description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars.","timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"Kilometers","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"}',

  "Trucking Time": '{"name":"Trucking Time","itemId":"3","type":"TRUCK","description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel time. Routes must obey one-way roads, avoid illegal turns, and so on.","timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"TruckTravelTime","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"attributeParameterValues":[{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_High"},{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBNoBacktrack","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"}',

  "Trucking Distance": '{"name":"Trucking Distance","itemId":"4","type":"TRUCK","description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel distance. Routes must obey one-way roads, avoid illegal turns, and so on.","timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"Kilometers","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"attributeParameterValues":[{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_High"},{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBNoBacktrack","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"}',

  "Walking Time" : '{"name":"Walking Time","itemId":"5","type":"WALK","description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel time. The walking speed is set to 5 kilometers per hour.","timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"WalkTime","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":false,"uturnAtJunctions":"esriNFSBAllowBacktrack","simplificationTolerance":2,"simplificationToleranceUnits":"esriMeters"}',

  "Walking Distance": '{"name":"Walking Distance","itemId":"6","type":"WALK","description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel distance.","timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"Kilometers","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":false,"uturnAtJunctions":"esriNFSBAllowBacktrack","simplificationTolerance":2,"simplificationToleranceUnits":"esriMeters"},{"name":"Rural Driving Time","itemId":"7","type":"AUTOMOBILE","description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"TravelTime","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"},{"name":"Rural Driving Distance","itemId":"8","type":"AUTOMOBILE","description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads.","timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","impedanceAttributeName":"Kilometers","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"attributeParameterValues":[{"attributeName":"Avoid Limited Access Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Ferries","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Unpaved Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Private Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Toll Roads","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Driving an Automobile","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Bus","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Taxi","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Walking","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving a Truck","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Driving an Emergency Vehicle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Through Traffic Prohibited","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Roads Under Construction Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Riding a Motorcycle","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Height Restriction","parameterName":"Vehicle Height (meters)","value":0},{"attributeName":"Weight Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight Restriction","parameterName":"Vehicle Weight (kilograms)","value":0},{"attributeName":"Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Length Restriction","parameterName":"Vehicle Length (meters)","value":0},{"attributeName":"Width Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Width Restriction","parameterName":"Vehicle Width (meters)","value":0},{"attributeName":"Truck with Trailers Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Truck with Trailers Restriction","parameterName":"Number of Trailers on Truck","value":0},{"attributeName":"Any Hazmat Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Avoid Gates","parameterName":"Restriction Usage","value":"Avoid_Medium"},{"attributeName":"Avoid Express Lanes","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Weight per Axle Restriction","parameterName":"Vehicle Weight per Axle (kilograms)","value":0},{"attributeName":"Axle Count Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Axle Count Restriction","parameterName":"Number of Axles","value":0},{"attributeName":"Avoid Carpool Roads","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Semi or Tractor with One or More Trailers Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Kingpin to Rear Axle Length Restriction","parameterName":"Vehicle Kingpin to Rear Axle Length (meters)","value":0},{"attributeName":"Single Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Tandem Axle Vehicles Prohibited","parameterName":"Restriction Usage","value":"Prohibited"},{"attributeName":"Use Preferred Truck Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Use Preferred Hazmat Routes","parameterName":"Restriction Usage","value":"Prefer_Medium"},{"attributeName":"Preferred for Pedestrians","parameterName":"Restriction Usage","value":"Prefer_Low"},{"attributeName":"Avoid Stairways","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"WalkTime","parameterName":"Walking Speed (km/h)","value":5},{"attributeName":"Avoid Truck Restricted Roads","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Roads Unsuitable for Pedestrians","parameterName":"Restriction Usage","value":"Avoid_High"},{"attributeName":"Avoid Toll Roads for Trucks","parameterName":"Restriction Usage","value":"Avoid_Medium"}],"useHierarchy":true,"uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","simplificationTolerance":10,"simplificationToleranceUnits":"esriMeters"}'
}

},{}]},{},[2,3,4]);
