/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

$(document).ready(function () {
    prepareLists();

    $('#clearAccount').click(clearAccount);
    $('#defineActivityShow').click(defineActivityModal);
    $('#createAppBundleActivity').click(createAppBundleActivity);
  $('#startExtractParams').click(startExtractParams);
  $('#startUpdateModel').click(startUpdateModel);

    startConnection();
});

function prepareLists() {
    //list('activity', '/api/forge/designautomation/activities');
    //list('engines', '/api/forge/designautomation/engines');
    //list('localBundles', '/api/appbundles');
  list('inputFile', '/api/forge/datamanagement/objects');
}

function list(control, endpoint) {
    $('#' + control).find('option').remove().end();
    jQuery.ajax({
        url: endpoint,
        success: function (list) {
            if (list.length === 0)
                $('#' + control).append($('<option>', { disabled: true, text: 'Nothing found' }));
            else
                list.forEach(function (item) { $('#' + control).append($('<option>', { value: item, text: item })); })
        }
    });
}

function clearAccount() {
    if (!confirm('Clear existing activities & appbundles before start. ' +
        'This is useful if you believe there are wrong settings on your account.' +
        '\n\nYou cannot undo this operation. Proceed?')) return;

    jQuery.ajax({
        url: 'api/forge/designautomation/account',
        method: 'DELETE',
        success: function () {
            prepareLists();
            writeLog('Account cleared, all appbundles & activities deleted');
        }
    });
}

function defineActivityModal() {
    $("#defineActivityModal").modal();
}

function createAppBundleActivity() {
    startConnection(function () {
        writeLog("Defining appbundle and activity for " + $('#engines').val());
        $("#defineActivityModal").modal('toggle');
        createAppBundle(function () {
            createActivity(function () {
                prepareLists();
            })
        });
    });
}

function createAppBundle(cb) {
    jQuery.ajax({
        url: 'api/forge/designautomation/appbundles',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            zipFileName: $('#localBundles').val(),
            engine: $('#engines').val()
        }),
        success: function (res) {
            writeLog('AppBundle: ' + res.appBundle + ', v' + res.version);
            if (cb) cb();
        }
    });
}

function createActivity(cb) {
    jQuery.ajax({
        url: 'api/forge/designautomation/activities',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            zipFileName: $('#localBundles').val(),
            engine: $('#engines').val()
        }),
        success: function (res) {
            writeLog('Activity: ' + res.activity);
            if (cb) cb();
        }
    });
}

function startExtractParams() {
    
    startConnection(function () {
      var data = JSON.stringify({
        documentPath: $('#documentPath').val(),
        projectPath: $('#projectPath').val(),
        inputFile: $('#inputFile').val(),
            browerConnectionId: connectionId
        });
        writeLog('Getting document parameters ...');
        $.ajax({
            url: 'api/forge/designautomation/workitems/extractparams',
          data: data,
          contentType: 'application/json',
            //processData: false,
            //contentType: false,
            method: 'POST',
            success: function (res) {
                writeLog('Workitem started: ' + res.workItemId);
            }
        });
    });
}

function startUpdateModel() {
  var inputFileField = document.getElementById('inputFile');
  if (inputFileField.files.length === 0) { alert('Please select an input file'); return; }
  if ($('#activity').val() === null) { alert('Please select an activity'); return };
  var file = inputFileField.files[0];
  startConnection(function () {
    var formData = new FormData();
    formData.append('inputFile', file);
    formData.append('data', JSON.stringify({
      width: $('#width').val(),
      height: $('#height').val(),
      activityName: $('#activity').val(),
      browerConnectionId: connectionId
    }));
    writeLog('Uploading input file...');
    $.ajax({
      url: 'api/forge/designautomation/workitems',
      data: formData,
      processData: false,
      contentType: false,
      type: 'POST',
      success: function (res) {
        writeLog('Workitem started: ' + res.workItemId);
      }
    });
  });
}

function writeLog(text) {
  $('#outputlog').append('<div style="border-top: 1px dashed #C0C0C0">' + text + '</div>');
  var elem = document.getElementById('outputlog');
  elem.scrollTop = elem.scrollHeight;
}

function updateParameters(message) {
  var parameters = $('#parameters');
  parameters.html('');

  let json = JSON.parse(message);
  for (let key in json) {
    let item = json[key];
    let id = `parameters_${key}`;

    if (item.values && item.values.length > 0) {
      parameters.append($(`
        <div class="form-group">
          <label for="${id}">${key}</label>
          <select class="form-control" id="${id}"></select>
        </div>`));
      let select = $(`#${id}`);
      for (let key2 in item.values) {
        let value = item.values[key2];
        select.append($('<option>', { value: value, text: value }))
      }
      // Activate current selection
      select.val(item.value);
    } else if (item.unit === "Boolean") {
      parameters.append($(`
        <div class="form-group">
          <label for="${id}">${key}</label>
          <select class="form-control" id="${id}">
            <option value="True">True</option>
            <option value="False">False</option>
          </select>
        </div>`));
      let select = $(`#${id}`);
      select.val(item.value);
    } else {
      parameters.append($(`
        <div class="form-group">
          <label for="${id}">${key}</label>
          <input type="text" class="form-control" id="${id}" placeholder="Enter new ${key} value">
        </div>`));
      let input = $(`#${id}`);
      input.val(item.value);
    }
  }
}

var connection;
var connectionId;

function startConnection(onReady) {
    if (connection && connection.connectionState) { if (onReady) onReady(); return; }
    connection = new signalR.HubConnectionBuilder().withUrl("/api/signalr/designautomation").build();
    connection.start()
        .then(function () {
            connection.invoke('getConnectionId')
                .then(function (id) {
                    connectionId = id; // we'll need this...
                    if (onReady) onReady();
                });
        });

    connection.on("downloadResult", function (url) {
        writeLog('<a href="' + url +'">Download result file here</a>');
    });

    connection.on("onComplete", function (message) {
        writeLog(message);
    });

    connection.on("onParameters", function (message) {
      updateParameters(message);
    });
}