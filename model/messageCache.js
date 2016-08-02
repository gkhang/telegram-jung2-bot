'use strict';

/*jshint camelcase: false */

const _ = require('lodash');

const bsearchMin = function (a, b, test) {
  // b is true and valid
  while (b - a > 1) {
    var mid = Math.floor((a + b) / 2);
    if (test(mid)) {
      b = mid;
    } else {
      a = mid;
    }
  }
  return b;
};

const bsearchMax = function (a, b, test) {
  // a is true and valid
  while (b - a > 1) {
    var mid = Math.floor((a + b) / 2);
    if (test(mid)) {
      a = mid;
    } else {
      b = mid;
    }
  }
  return a;
};

class User {

  constructor(userId, details) {
    this.id = userId;
    this.timestamps = [];
    this.details = details;
  }

  lastTimestamp() {
    let l = this.timestamps.length;
    if (l !== 0) {
      return this.timestamps[l - 1];
    } else {
      return null;
    }
  }

  addTimestamp(t) {
    // t is unix time accurate to second
    this.timestamps.push(t);
  }

  totalNumberOfMessage() {
    return this.timestamps.length;
  }

  numMsgBetween(start, end) {
    let ts = this.timestamps;
    let len = ts.length;
    var result = 0;
    if (len !== 0 && ts[len - 1] >= start && end >= ts[0]) {
      let mi = bsearchMin(-1, len - 1, function (i) {
        return start <= ts[i];
      });
      let mx = bsearchMax(0, len, function (i) {
        return ts[i] <= end;
      });
      result = mx - mi + 1;
    }
    return result;
  }

  name() {
    let detail = this.details;
    let result = '';
    if (!_.isEmpty(detail.first_name) && !_.isEmpty(detail.last_name)) {
      result = detail.first_name + ' ' + detail.last_name;
    } else if (!_.isEmpty(detail.first_name)) {
      result = detail.first_name;
    } else if (!_.isEmpty(detail.last_name)) {
      result = detail.last_name;
    } else if (!_.isEmpty(detail.username)) {
      result = detail.username;
    }
    return result;
  }

  sort() {
    this.timestamps.sort((a, b) => a - b);
  }

  clearTimestampBefore(time) {
    let ts = this.timestamps;
    let len = ts.length;
    if (len !== 0 && time >= ts[0]) {
      let ix = bsearchMax(0, len, function (i) {
        return ts[i] < time;
      });
      // todo: not sure whether V8 would actually free memory
      this.timestamps.splice(0, ix + 1);
    }
  }

}

class Group {

  constructor(id, details) {
    this.id = id;
    this.users = new Map();
    this.details = details;
  }

  hasUser(userId) {
    return this.users.has(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  setUser(userId, details) {
    this.users.set(userId, new User(userId, details));
  }

  replaceUserDetails(uid, details) {
    var user = this.getUser(uid);
    if (user) {
      user.details = details;
    }
  }

  totalNumberOfMessage() {
    var count = 0;
    for (let user of this.users.values()) {
      count += user.totalNumberOfMessage();
    }
    return count;
  }

  rank(startTime, endTime) {
    let rank = [];
    for (let user of this.users.values()) {
      rank.push({
        user: user.details,
        numMsg: user.numMsgBetween(startTime, endTime),
        lastTimestamp: user.lastTimestamp()
      });
    }
    rank.sort(function (a, b) {
      var t = b.numMsg - a.numMsg;
      if (t !== 0) {
        return t;
      }
      return b.lastTimestamp - a.lastTimestamp;     // latest message first
    });

    // total msg
    let total = 0;
    for (let i = 0; i < rank.length; i++) {
      total += rank[i].numMsg;
    }
    return {
      total: total,
      rank: rank
    };
  }

  sort() {
    for (let user of this.users.values()) {
      user.sort();
    }
  }

  clearTimestampBefore(time) {
    for (let user of this.users.values()) {
      user.clearTimestampBefore(time);
    }
  }

}

class MessageCache {

  constructor() {
    this.groups = new Map();
  }

  static isValid(msg) {
    var isDefined = x => typeof x !== 'undefined';
    return isDefined(msg) && isDefined(msg.chat) && isDefined(msg.from) && isDefined(msg.date);
  }

  /**
   *
   * Assumption:
   *  1. late coming msg always has larger or equal msg.date
   *
   * @param msg
   */
  addMessage(msg) {
    if (!MessageCache.isValid(msg)) {
      return false;
    }

    let gid = msg.chat.id;
    let uid = msg.from.id;

    // add group if not exist
    if (!this.hasGroup(gid)) {
      this.setGroup(gid, msg.chat);
    }
    this.replaceGroupDetails(gid, msg.chat);
    let group = this.getGroup(gid);

    // add user if not exist
    if (!group.hasUser(uid)) {
      group.setUser(uid, msg.from);
    }
    group.replaceUserDetails(uid, msg.from);
    let u = group.getUser(uid);

    u.addTimestamp(msg.date);

    return true;
  }

  hasGroup(gid) {
    return this.groups.has(gid);
  }

  getGroup(gid) {
    return this.groups.get(gid);
  }

  setGroup(gid, details) {
    return this.groups.set(gid, new Group(gid, details));
  }

  replaceGroupDetails(gid, details) {
    var group = this.getGroup(gid);
    if (group) {
      group.details = details;
    }
  }

  /**
   *
   * return rank considert number of message between startTime and endTime inclusively
   *
   * @param gid
   * @param startTime - unix timestamps in second
   * @param endTime - unix timestamps in second
   * @returns {*}
   */
  rankByGroupTimestamp(gid, startTime, endTime) {
    let group = this.getGroup(gid);

    if (typeof startTime !== 'number' || isNaN(startTime)) {
      throw new Error('start time must be a number ' + startTime);
    }
    if (typeof endTime !== 'number' || isNaN(endTime)) {
      throw new Error('end time must be a number ' + endTime);
    }

    if (group) {
      let groupRank = group.rank(startTime, endTime);
      return {
        group: group.details,
        total: groupRank.total,
        rank: groupRank.rank
      };
    } else {
      return {};
    }
  }

  /**
   *
   * re-sort just in case it violate assumption 1
   *
   */
  sort() {
    for (let group of this.groups.values()) {
      group.sort();
    }
  }

  /**
   *
   * free unnecessary timestamps
   *
   * @param time
   */
  clearTimestampBefore(time) {
    for (let group of this.groups.values()) {
      group.clearTimestampBefore(time);
    }
  }

  /**
   *
   * total number of messages cached
   *
   * @param number
   */
  totalNumberOfMessage() {
    var count = 0;
    for (let group of this.groups.values()) {
      count += group.totalNumberOfMessage();
    }
    return count;
  }
}

/*jshint camelcase: true */
module.exports = MessageCache;
