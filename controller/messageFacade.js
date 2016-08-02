'use strict';

// This is just a message controller facade

require('dotenv').load();
const MessageController = require('./' + process.env.MESSAGE_CONTROLLER);
const MessageCacheController = require('./../controller/messageCache');

exports.init = function(skip) {
  if ( MessageController.init && !skip ) {
    MessageController.init();
  }
};

exports.clearCachedLastSender = MessageController.clearCachedLastSender;

exports.setCachedLastSender = MessageController.setCachedLastSender;

exports.shouldAddMessage = MessageController.shouldAddMessage;

exports.addMessage = MessageController.addMessage;

exports.getAllGroupIds = MessageController.getAllGroupIds;

exports.getAllJung = MessageCacheController.getAllJung;

exports.getTopTen = MessageCacheController.getTopTen;
