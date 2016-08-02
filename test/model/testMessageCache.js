'use strict';

const util = require('util');
require('chai').should();
const MessageCache = require('../../model/messageCache.js');
const faker = require('faker');
var _ = require('lodash');

///////////////////////////////////////////////////////////
/// test set 1

const txt = faker.lorem.sentence();
let nUsers = 5000;
let users = [];
for (let i = 0; i < nUsers; i++) {
  users.push({
    id: i,
    username: faker.internet.userName(),
    first_name: faker.name.firstName(),
    last_name: faker.name.lastName()
  })
}

function randn() {
  var t = 0;
  for (var i = 0; i < 12; i++) t += Math.random();
  return t - 6;
}

function genMsg(groupId, userId, date) {
  return {
    chat: {
      id: groupId,
      type: 'group',    //  “private”, “group”, “supergroup” or “channel”
      title: '',        // optional
      username: '',	    // Optional. Username, for private chats and channels if available
      first_name: '',   // Optional. First name of the other party in a private chat
      last_name: ''     // Optional. Last name of the other party in a private chat
    },
    from: users[userId],
    date: date,
    text: txt
  };
}

///////////////////////////////////////////////////////////

describe('MessageCacheTest', function () {

  var cache = new MessageCache();
  var group = [];

  var getTotal = function (gid) {
    return group[gid].total;
  };

  var getRankUid = function (gid, i) {
    var userMsg = group[gid];
    return userMsg[i][0].from.id;
  };

  before(function () {

    this.timeout(60 * 1000);

    let date = 0;
    // let nGroup = 130; // similar to real scenario
    let nGroup = 10;

    for (var gid = 0; gid < nGroup; gid++) {
      // let nMsg = Math.floor(Math.random() * 10000) + 1000; // similar to real scenario
      let nMsg = 5000;
      let userMsg = new Map();

      for (var k = 0; k < nMsg; k++) {
        // select a user
        let uid = Math.floor(Math.abs(randn() * users.length)) % users.length; // has a bit bias
        date += k;
        let msg = genMsg(gid, uid, date);

        cache.addMessage(msg).should.equal(true);
        if (userMsg.has(uid)) {
          userMsg.get(uid).push(msg);
        } else {
          userMsg.set(uid, [msg]);
        }
      }

      var arr = [];
      userMsg.forEach((v) => arr.push(v));
      arr.sort(function (a, b) {
        var t = b.length - a.length;
        if (t !== 0) return t;
        return b[b.length - 1].date - a[a.length - 1].date;
      });

      arr.total = nMsg;
      group.push(arr);
    }
  });

  describe('RankByGroup', function () {

    it('can retrrieve all records in a simulated normal scenario', function (done) {
      this.timeout(20 * 1000);
      // for each group
      for (var gid = 0; gid < group.length; gid++) {
        // get rank
        var res = cache.rankByGroupTimestamp(gid, 0, 1e9);
        // check total
        res.total.should.equal(getTotal(gid));
        // compare generated data
        for (var i = 0; i < res.rank.length; i++) {
          (res.rank[i].user.id).should.equal(getRankUid(gid, i));
        }
      }
      done();
    });

    it('can retrieve partial records in a simulated normal scenario', function (done) {
      this.timeout(20 * 1000);
      // for each group
      for (var gid = 0; gid < group.length; gid++) {
        var result = cache.rankByGroupTimestamp(gid, 10000, 1e9);
        result.rank.length.should.greaterThan(0);
      }
      done();
    });

    it('can handle invalid message', function (done) {
      cache.addMessage('').should.equal(false);
      done();
    });

    it('can handle invalid startTime', function (done) {
      try {
        cache.rankByGroupTimestamp(0, '', 0);
      } catch (err) {
        err.message.should.match(/^start time must be a number/);
      } finally {
        done();
      }
    });

    it('can handle invalid endTime', function (done) {
      try {
        cache.rankByGroupTimestamp(0, 0, '');
      } catch (err) {
        err.message.should.match(/^end time must be a number/);
      } finally {
        done();
      }
    });

    it('can sort all timestamps in ascending order', function (done) {
      this.timeout(10 * 1000);
      let users = cache.getGroup(0).users;
      let user = null;
      for (var key of users.keys()) {
        user = users.get(key);
        if (user.timestamps.length > 1) {
          break;
        }
      }
      // make it into descending order
      user.timestamps.sort(function (a, b) {
        return b - a;
      });
      user.timestamps[0].should.be.greaterThan(user.timestamps[1]);
      cache.sort();
      // now is ascending
      user.timestamps[0].should.be.lessThan(user.timestamps[1]);
      done();
    });

    it('can clear outdated messages', function (done) {
      this.timeout(20 * 1000);
      var cacheCopy = _.cloneDeep(cache);
      let totalNumberOfMessageBefore = cacheCopy.totalNumberOfMessage();
      cacheCopy.clearTimestampBefore(10000);
      let totalNumberOfMessageAfter = cacheCopy.totalNumberOfMessage();
      totalNumberOfMessageAfter.should.be.lessThan(totalNumberOfMessageBefore);
      done();
    });

    it('can display name', function (done) {
      this.timeout(20 * 1000);
      let stubMsgs = [{
        chat: {id: 123, type: 'group'},
        from: {id: 1, username: 'stubUsername', first_name: 'stubFirstName', last_name: 'stubLastName'},
        date: 1000,
        text: 'hi'
      }, {
        chat: {id: 123, type: 'group'},
        from: {id: 2, username: 'stubUsername', first_name: 'stubFirstName', last_name: ''},
        date: 1001,
        text: 'hi'
      }, {
        chat: {id: 123, type: 'group'},
        from: {id: 3, username: 'stubUsername', first_name: '', last_name: 'stubLastName'},
        date: 1002,
        text: 'hi'
      }, {
        chat: {id: 123, type: 'group'},
        from: {id: 4, username: 'stubUsername', first_name: '', last_name: ''},
        date: 1003,
        text: 'hi'
      }, {
        chat: {id: 123, type: 'group'},
        from: {id: 5, username: '', first_name: '', last_name: ''},
        date: 1004,
        text: 'hi'
      }];
      let nameCache = new MessageCache();
      for (let msg of stubMsgs) {
        nameCache.addMessage(msg);
      }
      nameCache.getGroup(123).getUser(1).name().should.equal('stubFirstName stubLastName');
      nameCache.getGroup(123).getUser(2).name().should.equal('stubFirstName');
      nameCache.getGroup(123).getUser(3).name().should.equal('stubLastName');
      nameCache.getGroup(123).getUser(4).name().should.equal('stubUsername');
      nameCache.getGroup(123).getUser(5).name().should.equal('');
      done();
    });

    it('can handle empty timestamps', function (done) {
      let emptyTimestampsCache = new MessageCache();
      emptyTimestampsCache.addMessage({
        chat: {id: 123, type: 'group'},
        from: {id: 1, username: 'stubUsername', first_name: 'stubFirstName', last_name: 'stubLastName'},
        date: 1000,
        text: 'hi'
      });
      let user = emptyTimestampsCache.getGroup(123).getUser(1);
      user.timestamps = [];
      _.isNull(user.lastTimestamp()).should.equal(true);
      done();
    });

    it('can handle empty group', function (done) {
      let emptyCache = new MessageCache();
      let testReuslt = _.isEmpty(emptyCache.rankByGroupTimestamp(0, 0, 1e9)) &&
        _.isObject(emptyCache.rankByGroupTimestamp(0, 0, 1e9));
      testReuslt.should.equal(true);
      done();
    });

    it('will not throw error if cannot find group when replacing', function (done) {
      let emptyCache = new MessageCache();
      emptyCache.replaceGroupDetails(-1, null);
      done();
    });

    it('will not throw error if cannot find user when replacing', function (done) {
      let emptyCache = new MessageCache();
      emptyCache.addMessage({
        chat: {id: 123, type: 'group'},
        from: {id: 1, username: 'stubUsername', first_name: 'stubFirstName', last_name: 'stubLastName'},
        date: 1000,
        text: 'hi'
      });
      emptyCache.getGroup(123).replaceUserDetails(-1);
      done();
    });

  });

});