'use strict';

const util = require('util');
require('chai').should();
const MessageCache = require('../../controller/messageCache.js');
const faker = require('faker');

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

  describe('correctness test', function () {

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
      this.timeout(10 * 1000);

      let date = 0;
      let nGroup = 10;

      for (var gid = 0; gid < nGroup; gid++) {
        let nMsg = Math.floor( Math.random() * 20000 ) + 1000 ;
        // let nMsg = 10000;
        let userMsg = new Map();

        for (var k = 0; k < nMsg; k++) {
          // select a user
          let uid = Math.floor(Math.abs(randn() * users.length)) % users.length; // has a bit bias
          let msg = genMsg(gid, uid, date++);

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

    describe('rankByGroup', function () {

      it('can handle a simulated normal scenario', function (done) {
        this.timeout(5 * 1000);
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

      it('can handle invalid message', function (done) {
        cache.addMessage('').should.equal(false);
        done();
      });

    });

  });

});