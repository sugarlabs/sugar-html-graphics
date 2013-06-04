define(function (require) {
    var bus = require("sugar-web/bus");

    var datastore = {};

    function DatastoreObject(objectId) {
        this.objectId = objectId;
        this.newMetadata = {};

        var that = this;

        this.blobToText = function (blob, callback) {
            var reader = new FileReader();
            reader.onload = function (e) {
                callback(e.target.result);
            };
            reader.readAsText(blob);
        };

        this.blobToArrayBuffer = function (blob, callback) {
            var reader = new FileReader();
            reader.onload = function (e) {
                callback(e.target.result);
            };
            reader.readAsArrayBuffer(blob);
        };

        this.saveText = function (metadata, callback) {
            var that = this;

            function onSaved(error, outputStream) {
                var blob = new Blob([that.newDataAsText]);

                that.blobToArrayBuffer(blob, function (buffer) {
                    outputStream.write(buffer);
                    outputStream.close(callback);
                });
            }

            datastore.save(that.objectId, metadata, onSaved);
        };

        this.applyChanges = function (metadata, callback) {
            for (var key in this.newMetadata) {
                metadata[key] = this.newMetadata[key];
            }

            if (this.newDataAsText !== undefined) {
                this.saveText(metadata, callback);
            } else {
                datastore.setMetadata(this.objectId, metadata, callback);
            }
        };
    }

    DatastoreObject.prototype.getMetadata = function (callback) {
        datastore.getMetadata(this.objectId, callback);
    };

    DatastoreObject.prototype.loadAsText = function (callback) {
        var that = this;
        var inputStream = null;
        var arrayBuffers = [];
        var metadata = null;

        function onRead(error, data) {
            if (data.byteLength == 0) {
                var blob = new Blob(arrayBuffers);

                that.blobToText(blob, function (text) {
                    callback(null, metadata, text);
                });

                inputStream.close();

                return;
            }

            arrayBuffers.push(data);

            inputStream.read(8192, onRead);
        }

        function onLoad(error, loadedMetadata, loadedInputStream) {
            metadata = loadedMetadata;
            inputStream = loadedInputStream;

            inputStream.read(8192, onRead);
        }

        datastore.load(this.objectId, onLoad);
    };

    DatastoreObject.prototype.setMetadata = function (metadata) {
        for (var key in metadata) {
            this.newMetadata[key] = metadata[key];
        }
    };

    DatastoreObject.prototype.setDataAsText = function (text) {
        this.newDataAsText = text;
    };

    DatastoreObject.prototype.save = function (callback) {
        var that = this;

        if (this.objectId === undefined) {
            datastore.create(this.newMetadata, function (error, objectId) {
                that.objectId = objectId;
                that.applyChanges({}, callback);
            });
        } else {
            datastore.getMetadata(this.objectId, function (error, metadata) {
                that.applyChanges(metadata, callback);
            });
        }
    };

    datastore.DatastoreObject = DatastoreObject;


    datastore.setMetadata = function (objectId, metadata, callback) {
        function onResponseReceived(error, result) {
            if (error === null) {
                callback(null);
            } else {
                callback(error);
            }
        }

        var params = [objectId, metadata];
        bus.sendMessage("datastore.set_metadata", params, onResponseReceived);
    };

    datastore.getMetadata = function (objectId, callback) {
        function onResponseReceived(error, result) {
            if (error === null) {
                callback(null, result[0]);
            } else {
                callback(error, null);
            }
        }

        var params = [objectId];
        bus.sendMessage("datastore.get_metadata", params, onResponseReceived);
    };

    datastore.load = function (objectId, callback) {
        inputStream = bus.createInputStream();

        inputStream.open(function (error) {
            function onResponseReceived(responseError, result) {
                if (responseError === null) {
                    callback(null, result[0], inputStream);
                } else {
                    callback(responseError, null, null);
                }
            }

            var params = [objectId, inputStream.streamId];
            bus.sendMessage("datastore.load", params, onResponseReceived);
        });
    };

    datastore.create = function (metadata, callback) {
        function onResponseReceived(responseError, result) {
            if (responseError === null) {
                callback(null, result[0]);
            } else {
                callback(responseError, null);
            }
        }

        var params = [metadata];
        bus.sendMessage("datastore.create", params, onResponseReceived);
    };

    datastore.save = function (objectId, metadata, callback) {
        outputStream = bus.createOutputStream();

        outputStream.open(function (error) {
            function onResponseReceived(responseError, result) {
                if (responseError === null) {
                    callback(null, outputStream);
                } else {
                    callback(responseError, null);
                }
            }

            var params = [objectId, metadata, outputStream.streamId];
            bus.sendMessage("datastore.save", params, onResponseReceived);
        });
    };

    return datastore;
});
