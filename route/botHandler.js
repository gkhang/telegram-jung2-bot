'use strict';

const log = require('log-to-file-and-console-node');
const MessageFacade = require('../controller/messageFacade');
const HelpController = require('../controller/help');
const _ = require('lodash');

exports.onTopTen = function (msg, bot) {
  log.i('/topten msg: ' + JSON.stringify(msg), process.env.DISABLE_LOGGING);
  MessageFacade.getTopTen(msg).then(function onSuccess(message) {
    if (!_.isEmpty(message)) {
      log.i('/topten sendBot to ' + msg.chat.id + ' message: ' + message, process.env.DISABLE_LOGGING);
      bot.sendMessage(msg.chat.id, message);
    } else {
      log.e('/topten: message is empty', process.env.DISABLE_LOGGING);
    }
  }, function onFailure(err) {
    log.e('/topten err: ' + err.message, process.env.DISABLE_LOGGING);
    bot.sendMessage(msg.chat.id, err.message);
  });
};

exports.onAllJung = function (msg, bot) {
  log.i('/alljung msg: ' + JSON.stringify(msg), process.env.DISABLE_LOGGING);
  MessageFacade.getAllJung(msg).then(function onSuccess(message) {
    if (!_.isEmpty(message)) {
      log.i('/alljung sendBot to ' + msg.chat.id + ' message: ' + message, process.env.DISABLE_LOGGING);
      bot.sendMessage(msg.chat.id, message);
    } else {
      log.e('/alljung: message is empty', process.env.DISABLE_LOGGING);
    }
  }, function onFailure(err) {
    log.e('/alljung err: ' + err.message, process.env.DISABLE_LOGGING);
    bot.sendMessage(msg.chat.id, err.message);
  });
};

exports.onHelp = function (msg, bot) {
  bot.sendMessage(msg.chat.id, HelpController.getHelp());
};

exports.onMessage = function (msg) {
  log.i('msg: ' + JSON.stringify(msg), process.env.DISABLE_LOGGING);
  if (MessageFacade.shouldAddMessage(msg)) {
    MessageFacade.addMessage(msg, function () {
      log.i('add message success', process.env.DISABLE_LOGGING);
    });
  } else {
    log.e('skip repeated message', process.env.DISABLE_LOGGING);
  }
};