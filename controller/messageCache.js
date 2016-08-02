'use strict';

const MessageCache = require('./../model/messageCache');
const UsageController = require('./usage');
const Constants = require('../model/constants');
require('moment');
const moment = require('moment-timezone');

const cache = new MessageCache();

const getCachedResult = function (msg) {
  const gid = msg.from.id;
  const startTime = moment().subtract(7, 'day').unix();
  const endTime = moment().unix();
  let rankResult = cache.rankByGroupTimestamp(gid, startTime, endTime);
  console.log(rankResult);
  return '';
};

const getJungMessage = function (msg, limit, force) {
  let message = limit ? Constants.MESSAGE.TOP_TEN_TITLE : Constants.MESSAGE.ALL_JUNG_TITLE;
  let cachedResult = getCachedResult(msg);
  return UsageController.isAllowCommand(msg, force).then(function onSuccess() {
    let promises = [
      UsageController.addUsage(msg),
      Promise.resolve(cachedResult)
    ];
    return Promise.all(promises).then(function (results) {
      return results[1];
    });
  }, function onFailure(usage) {
    if (usage.notified) {
      message = '';
    } else {
      const oneMinutesLater = moment(usage.dateCreated)
        .add(Constants.CONFIG.COMMAND_COOLDOWN_TIME, 'minute')
        .tz('Asia/Hong_Kong');
      message = '[Error] Commands will be available ' + oneMinutesLater.fromNow() +
        ' (' + oneMinutesLater.format('h:mm:ss a') + ' HKT).';
    }
    return message;
  });
};

exports.getAllJung = function (msg, force) {
  return getJungMessage(msg, 0, force);
};

exports.getTopTen = function (msg, force) {
  return getJungMessage(msg, 10, force);
};
