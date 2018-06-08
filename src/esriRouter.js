/* to do:
make a GIF
why doesnt map load until OAuth user signs in?
doc parameters in a table
round response geometry to 5 decimal places
*/
(function() {
	'use strict';

	var L = require('leaflet');
	var xhr = require('xhr');
	
	// Ignore camelcase naming for this file, since OSRM's API uses
	// underscores.
	/* jshint camelcase: false */
  require('leaflet-routing-machine');

  var profiles = require('./profiles.js');

	module.exports = L.Class.extend({
    options: {
			// users can supply a proxied url instead of a token
			serviceUrl: 'https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World',
			timeout: 30 * 1000,
			routingOptions: {
				profile: 'Driving',
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
				body
				// xhr;

			options = L.extend({}, this.options.routingOptions, options);
			url = this.options.serviceUrl + '/solve';
			
			body = this.buildRouteUrl(waypoints, options);
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

			return xhr({
			  method: "post",
			  uri: url,
			  body: body,
			  headers: {
			    "Content-Type": "application/x-www-form-urlencoded"
			  }
			}, L.bind(function(err, resp) {
				var data,
					error =  {};

				clearTimeout(timer);
				if (!timedOut) {
					if (!err) {
						try {
							data = JSON.parse(resp.body);
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

      // ours service doesnt give stop coordinates real names in summary
			result.name = ''; // legNames.join(', ');

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
			// var completeServiceUrl = this.options.serviceUrl + '/solve';

			var params = "f=json";
			params += "&returnStops=true";
			params += "&directionsLengthUnits=esriNAUMeters";
			params += "&directionsOutputType=esriDOTComplete";

			if (this.options.liveTraffic) {
				params += "&startTimeisUTC=true";
				params += "&startTime=" + new Date().getTime();
			}

			if (this.options.profile) {
				params += "&travelMode=" + profiles[this.options.profile];
			}

			if (this.options.token) {
				params += "&token=" + this.options.token;
			}

			params += "&stops=" + locs.join(';');

			return params;
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
