# Leaflet Routing Machine - Esri plugin

> enables walk, drive and truck routing using Esri's hosted service.

### Demo
Check out the live [demo](http://jgravois.github.io/lrm-esri/examples/index.html).

### Usage
<!-- place GIF here-->

```html
<script src="./lrm-esri.js"></script>
```

```js
var control = L.Routing.control({
	router: L.Routing.esri({
    liveTraffic: true,
    /* also supports: Driving Distance,
    Walking Time, Walking Distance,
    Trucking Time, Trucking Distance
    */
    profile: 'Driving Time'
  })
}).addTo(map);
```

### Development Instructions

If you'd like to inspect and modify the source of lrm-esri, follow the instructions below to set up a local development environment.

1. [Fork and clone](https://help.github.com/articles/fork-a-repo)
2. `cd` into the `lrm-esri` folder
3. Install the `package.json` dependencies by running `npm install`
4. Run `npm start` from the command line. This will recompile minified source in the `dist` directory, launch a tiny webserver and begin watching the raw source for changes.
5. Run http://localhost:8080/examples/index.html to check out your changes
6. Create a [pull request](https://help.github.com/articles/creating-a-pull-request)

### Dependencies

* `leaflet`
* `leaflet-routing-machine`
* `cors-lite`

this plugin does *not* depend on [Esri Leaflet](https://esri.github.io/esri-leaflet).

### Resources

* [ArcGIS for Developers](http://developers.arcgis.com)
* [REST documentation for routing service](http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Route_service_with_synchronous_execution/02r300000036000000/)

### Issues

Find a bug or want to request a new feature?  Please let us know by submitting an [issue](https://github.com/jgravois/lrm-esri/issues).

### Contributing

Esri welcomes contributions from anyone and everyone. Please see our [guidelines for contributing](https://github.com/Esri/esri-leaflet/blob/master/CONTRIBUTING.md).

### Licensing
Copyright 2017 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

> http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [LICENSE](./LICENSE) file.

[](Esri Tags: ArcGIS Web Mapping Leaflet)
[](Esri Language: JavaScript)
