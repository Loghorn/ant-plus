'use strict';
var GulpConfig = (function () {
    function GulpConfig() {
        //Got tired of scrolling through all the comments so removed them
        //Don't hurt me AC :-)
        this.source = './';
        this.sourceApp = this.source + '/src';

        this.tsOutputPath = this.source + '/build';
        this.allJavaScript = [this.source + '/**/*.js'];
        this.allTypeScript = this.sourceApp + '/**/*.ts';

        this.typings = './typings/';
        this.libraryTypeScriptDefinitions = './typings/**/*.ts';
        this.appTypeScriptReferences = this.typings + 'ant.d.ts';
    }
    return GulpConfig;
})();
module.exports = GulpConfig;