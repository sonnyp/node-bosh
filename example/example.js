#!/usr/bin/env node

var BOSH = require('../lib/BOSH').BOSH;
var URL = 'http://yuilop:5280/http-bind'
var HOST = 'yuilop';

var connection = new BOSH(URL, {
  'to': HOST,
  'wait': 10
});

connection.on('open', function() {
  console.log('open: ' + new Date() + '\n');
});

connection.on('end', function() {
  console.log('end: ' + new Date() + '\n');
})

connection.on('error', function(error) {
  console.log('error: ' + (new Date()) + '\n' + error + '\n');
});
connection.on('close', function() {
  console.log('close: ' + new Date() + '\n');
});

connection.on('rawin', function(data) {
  console.log('rawin: ' + (new Date()) + '\n' + data + '\n');
});
connection.on('rawout', function(data) {
  console.log('rawout: ' + (new Date()) + '\n' + data + '\n');
});

/*
connection.on('in', function(data) {
  console.log('in: ' + (new Date()) + '\n' + data + '\n');
});
connection.on('out', function(data) {
  console.log('out: ' + (new Date()) + '\n' + data + '\n');
});
*/