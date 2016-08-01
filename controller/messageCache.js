'use strict';

/*jshint camelcase: false */

let bsearchMin = function (a, b, test) {
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

let bsearchMax = function (a, b, test) {
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
    var result = null;
    if (l !== 0) {
      result = this.timestamps[l - 1];
    }
    return result;
  }

  addTimestamp(t) {
    // t is unix time accurate to second
    this.timestamps.push(t);
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
    let d = this.details;
    let result = '';
    if (d.first_name && d.last_name) {
      result = d.first_name + ' ' + d.last_name;
    } else if (d.first_name) {
      result = d.first_name;
    } else if (d.last_name) {
      result = d.last_name;
    } else if (d.username) {
      result = d.username;
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
    var u = this.getUser(uid);
    if (typeof u !== 'undefined') {
      u.details = details;
    }
  }

  // patchUserDetails(userId, details) {
  //   var u = this.getUser(userId);
  //   for (let k in details) {
  //     if (details.hasOwnProperty(k)) {
  //       u.details[k] = details[k];
  //     }
  //   }
  // }

  rank(startTime, endTime) {
    let rank = [];
    for (let u of this.users.values()) {
      rank.push({
        user: u.details,
        numMsg: u.numMsgBetween(startTime, endTime),
        lastTimestamp: u.lastTimestamp()
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
    for (let u of this.users.values()) {
      u.sort();
    }
  }

  clearTimestampBefore(time) {
    for (let u of this.users.values()) {
      u.clearTimestampBefore(time);
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
    let g = this.getGroup(gid);

    // add user if not exist
    if (!g.hasUser(uid)) {
      g.setUser(uid, msg.from);
    }
    g.replaceUserDetails(uid, msg.from);
    let u = g.getUser(uid);

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
    var g = this.getGroup(gid);
    if (typeof g !== 'undefined') {
      g.details = details;
    }
  }

  // patchGroupDetails(gid, details) {
  //   var g = this.getGroup(gid);
  //   if (typeof g === 'undefined') {
  //     return;
  //   }
  //   for (let k in details) {
  //     if (details.hasOwnProperty(k)) {
  //       g.details[k] = details[k];
  //     }
  //   }
  // }

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
    let g = this.getGroup(gid);
    var result = {};

    if (typeof startTime !== 'number' || isNaN(startTime)) {
      throw new Error('start time must be a number ' + startTime);
    }
    if (typeof endTime !== 'number' || isNaN(endTime)) {
      throw new Error('end time must be a number ' + endTime);
    }

    if (typeof g !== 'undefined') {
      let gr = g.rank(startTime, endTime);
      result = {
        group: g.details,
        total: gr.total,
        rank: gr.rank
      };
    }
    return result;
  }

  // rankByGroupDate(gid, startDate, endDate) {
  //   let unixTime = (d) => Math.round(d.getTime() / 1000);
  //   return this.rankByGroup(gid, unixTime(startDate), unixTime(endDate));
  // }

  /**
   *
   * re-sort just in case it violate assumption 1
   *
   */
  sort() {
    for (let g of this.groups.values()) {
      g.sort();
    }
  }

  /**
   *
   * free unnecessary timestamps
   *
   * @param time
   */
  clearTimestampBefore(time) {
    for (let g of this.groups.values()) {
      g.clearTimestampBefore(time);
    }
  }
}

/*jshint camelcase: true */
module.exports = MessageCache;

// var stubMsg = {
//  chat: {
//    id: 123,
//    type: 'group',    //  “private”, “group”, “supergroup” or “channel”
//    title: '',        // optional
//    username: '',	    // Optional. Username, for private chats and channels if available
//    first_name: '',   // Optional. First name of the other party in a private chat
//    last_name: ''     // Optional. Last name of the other party in a private chat
//  },
//  from: {
//    id: 123,             // integer
//    username: 'stubUsername',
//    first_name: 'stubFirstName',  // optional
//    last_name: 'stubLastName'     // optional
//  },
//  date: 1462008157,
//  text: 'hi'
// };
