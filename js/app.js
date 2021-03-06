/**
 * Copyright 2013 dc-square GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author: Christoph Schäbel
 */

var websocketclient = {
    // 对象属性
    'client': null,     //mqtt对象
    'lastMessageId': 1, 
    'lastSubId': 1,    //最新订阅的ID
    'subscriptions': [],   //所有订阅的主题的数组
    'messages': [],        //所有消息的对象数组
    'connected': false,   //连接状态

    // 对象方法
    'connect': function () {
        console.log("--------进入connect--------------");

        // jqurey的语法：拿到id为urlInput里面的值
        var host = $('#urlInput').val();
        var port = parseInt($('#portInput').val(), 10);
        var clientId = $('#clientIdInput').val();
        var username = $('#userInput').val();
        var password = $('#pwInput').val();
        var keepAlive = parseInt($('#keepAliveInput').val());
        var cleanSession = $('#cleanSessionInput').is(':checked');
        var lwTopic = $('#lwTopicInput').val();
        var lwQos = parseInt($('#lwQosInput').val());
        var lwRetain = $('#LWRInput').is(':checked');
        var lwMessage = $('#LWMInput').val();
        var ssl = $('#sslInput').is(':checked');

        console.log("---------aplex  debug-------------");
        console.log("host=", host);
        console.log("port=", port);
        console.log("clientId=", clientId);
        console.log("username=", username);
        console.log("password=", password);
        console.log("keepAlive=", keepAlive);
        console.log("cleanSession=", cleanSession);
        console.log("lwTopic=", lwTopic);
        console.log("lwQos=", lwQos);
        console.log("lwRetain=", lwRetain);
        console.log("lwMessage=", lwMessage);
        console.log("ssl=", ssl);

        // mqttws31.js
        this.client = new Messaging.Client(host, port, clientId);
        //设置断开链接时的回调函数
        this.client.onConnectionLost = this.onConnectionLost;
        //设置接收到消息后的回调函数
        this.client.onMessageArrived = this.onMessageArrived;
        // 参数的对象
        var options = {
            timeout: 3,
            keepAliveInterval: keepAlive,
            cleanSession: cleanSession,
            useSSL: ssl,
            onSuccess: this.onConnect,
            onFailure: this.onFail
        };

        if (username.length > 0) {
            options.userName = username;
        }
        if (password.length > 0) {
            options.password = password;
        }
        if (lwTopic.length > 0) {
            var willmsg = new Messaging.Message(lwMessage);
            willmsg.qos = lwQos;
            willmsg.destinationName = lwTopic;
            willmsg.retained = lwRetain;
            options.willMessage = willmsg;
        }
        //连接
        this.client.connect(options);
    },

    'onConnect': function () {
        websocketclient.connected = true;
        console.log("--------进入onConnect--------------");
        var body = $('body').addClass('connected').removeClass('notconnected').removeClass('connectionbroke');

        websocketclient.render.hide('conni');
        websocketclient.render.show('publish');
        websocketclient.render.show('sub');
        websocketclient.render.show('messages');
    },

    'onFail': function (message) {
        websocketclient.connected = false;
        console.log("--------进入onFail--------------");
        console.log("error: " + message.errorMessage);
        websocketclient.render.showError('Connect failed: ' + message.errorMessage);
    },

    'onConnectionLost': function (responseObject) {
        websocketclient.connected = false;
        console.log("--------进入onConnectionLost--------------");
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObject.errorMessage);
        }
        $('body.connected').removeClass('connected').addClass('notconnected').addClass('connectionbroke');
        websocketclient.render.show('conni');
        websocketclient.render.hide('publish');
        websocketclient.render.hide('sub');
        websocketclient.render.hide('messages');

        //Cleanup messages
        websocketclient.messages = [];
        websocketclient.render.clearMessages();

        //Cleanup subscriptions
        websocketclient.subscriptions = [];
        websocketclient.render.clearSubscriptions();
    },

    //接收信息
    'onMessageArrived': function (message) {
        console.log("--------进入onMessageArrived--------------");
        //拿到订阅的主题
        var subscription = websocketclient.getSubscriptionForTopic(message.destinationName);

        var messageObj = {
            'topic': message.destinationName,
            'retained': message.retained,
            'qos': message.qos,
            'payload': message.payloadString,  //数据
            'timestamp': moment(),
            'subscriptionId': subscription.id,
            'color': websocketclient.getColorForSubscription(subscription.id)
        };

        console.log(messageObj);
        //更新web界面
        messageObj.id = websocketclient.render.message(messageObj);
        //放入消息数组
        websocketclient.messages.push(messageObj);
    },

    'disconnect': function () {
        console.log("--------进入disconnect--------------");
        this.client.disconnect();
    },

    //发布消息
    'publish': function (topic, payload, qos, retain) {
        console.log("--------进入publish--------------");
        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }
        //创建一个mqtt格式消息
        var message = new Messaging.Message(payload);
        message.destinationName = topic;
        message.qos = qos;
        message.retained = retain;
        //发送
        this.client.send(message);
    },
    // 订阅主题
    'subscribe': function (topic, qosNr, color) {
        console.log("--------进入subscribe--------------");
        //未连接，错误
        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }
        //主题为空，弹窗错误返回
        if (topic.length < 1) {
            websocketclient.render.showError("Topic cannot be empty");
            return false;
        }
        //订阅过相同主题，错误
        if (_.find(this.subscriptions, { 'topic': topic })) {
            websocketclient.render.showError('You are already subscribed to this topic');
            return false;
        }
        //将主题加入到mqtt协议中去
        this.client.subscribe(topic, {qos: qosNr});
        if (color.length < 1) {
            color = '999999';
        }
        //创建一个订阅的对象
        var subscription = {'topic': topic, 'qos': qosNr, 'color': color};
        //在web界面增加一个显示订阅的主题
        subscription.id = websocketclient.render.subscription(subscription);
        //加入数组
        this.subscriptions.push(subscription);
        return true;
    },

    'unsubscribe': function (id) {
        console.log("--------进入unsubscribe--------------");
        var subs = _.find(websocketclient.subscriptions, {'id': id});
        this.client.unsubscribe(subs.topic);
        websocketclient.subscriptions = _.filter(websocketclient.subscriptions, function (item) {
            return item.id != id;
        });

        websocketclient.render.removeSubscriptionsMessages(id);
    },

    'deleteSubscription': function (id) {
        console.log("--------进入deleteSubscription--------------");
        var elem = $("#sub" + id);

        if (confirm('Are you sure ?')) {
            elem.remove();
            this.unsubscribe(id);
        }
    },

    'getRandomColor': function () {
        console.log("--------进入getRandomColor--------------");
        var r = (Math.round(Math.random() * 255)).toString(16);
        var g = (Math.round(Math.random() * 255)).toString(16);
        var b = (Math.round(Math.random() * 255)).toString(16);
        return r + g + b;
    },

    'getSubscriptionForTopic': function (topic) {
        console.log("--------进入getSubscriptionForTopic--------------");
        var i;
        for (i = 0; i < this.subscriptions.length; i++) {
            if (this.compareTopics(topic, this.subscriptions[i].topic)) {
                return this.subscriptions[i];
            }
        }
        return false;
    },

    'getColorForPublishTopic': function (topic) {
        console.log("--------进入getColorForPublishTopic--------------");
        var id = this.getSubscriptionForTopic(topic);
        return this.getColorForSubscription(id);
    },

    'getColorForSubscription': function (id) {
        console.log("--------进入getColorForSubscription--------------");
        try {
            if (!id) {
                return '99999';
            }

            var sub = _.find(this.subscriptions, { 'id': id });
            if (!sub) {
                return '999999';
            } else {
                return sub.color;
            }
        } catch (e) {
            return '999999';
        }
    },

    'compareTopics': function (topic, subTopic) {
        console.log("--------进入compareTopics--------------");
        var pattern = subTopic.replace("+", "(.+?)").replace("#", "(.*)");
        var regex = new RegExp("^" + pattern + "$");
        return regex.test(topic);
    },

    'render': {

        'showError': function (message) {
            console.log("--------进入render.showError--------------");
            alert(message);
        },
        'messages': function () {
            console.log("--------进入render.messages--------------");
            websocketclient.render.clearMessages();
            _.forEach(websocketclient.messages, function (message) {
                message.id = websocketclient.render.message(message);
            });

        },
        'message': function (message) {
            console.log("--------进入render.message--------------");
            var largest = websocketclient.lastMessageId++;

            var html = '<li class="messLine id="' + largest + '">' +
                '   <div class="row large-12 mess' + largest + '" style="border-left: solid 10px #' + message.color + '; ">' +
                '       <div class="large-12 columns messageText">' +
                '           <div class="large-3 columns date">' + message.timestamp.format("YYYY-MM-DD HH:mm:ss") + '</div>' +
                '           <div class="large-5 columns topicM truncate" id="topicM' + largest + '" title="' + Encoder.htmlEncode(message.topic, 0) + '">Topic: ' + Encoder.htmlEncode(message.topic) + '</div>' +
                '           <div class="large-2 columns qos">Qos: ' + message.qos + '</div>' +
                '           <div class="large-2 columns retain">';
            if (message.retained) {
                html += 'Retained';
            }
            html += '           </div>' +
                '           <div class="large-12 columns message break-words">' + Encoder.htmlEncode(message.payload) + '</div>' +
                '       </div>' +
                '   </div>' +
                '</li>';
            $("#messEdit").prepend(html);
            return largest;
        },

        'subscriptions': function () {
            console.log("--------进入render.subscriptions--------------");
            websocketclient.render.clearSubscriptions();
            _.forEach(websocketclient.subscriptions, function (subs) {
                subs.id = websocketclient.render.subscription(subs);
            });
        },

        'subscription': function (subscription) {

            console.log("--------进入render.subscription--------------");
            var largest = websocketclient.lastSubId++;
            // 向订阅的主题列表中增加一个
            $("#innerEdit").append(
                '<li class="subLine" id="sub' + largest + '">' +
                    '   <div class="row large-12 subs' + largest + '" style="border-left: solid 10px #' + subscription.color + '; background-color: #ffffff">' +
                    '       <div class="large-12 columns subText">' +
                    '           <div class="large-1 columns right closer">' +
                    '              <a href="#" onclick="websocketclient.deleteSubscription(' + largest + '); return false;">x</a>' +
                    '           </div>' +
                    '           <div class="qos">Qos: ' + subscription.qos + '</div>' +
                    '           <div class="topic truncate" id="topic' + largest + '" title="' + Encoder.htmlEncode(subscription.topic, 0) + '">' + Encoder.htmlEncode(subscription.topic) + '</div>' +
                    '       </div>' +
                    '   </div>' +
                    '</li>');
            //返回id
            return largest;
        },

        'toggleAll': function () {
            console.log("--------进入render.toggleAll--------------");
            websocketclient.render.toggle('conni');
            websocketclient.render.toggle('publish');
            websocketclient.render.toggle('messages');
            websocketclient.render.toggle('sub');
        },
        // 
        'toggle': function (name) {   

            console.log("--------进入render.toggle--------------");
            $('.' + name + 'Arrow').toggleClass("closed");
            $('.' + name + 'Top').toggleClass("closed");
            var elem = $('#' + name + 'Main');
            
            console.log("test1="+'.' + name + 'Arrow');
            console.log("test2="+'.' + name + 'Top');
            console.log("test3="+'#' + name + 'Main');

            elem.slideToggle();
        },

        'hide': function (name) {
            console.log("--------进入render.hide--------------");
            $('.' + name + 'Arrow').addClass("closed");
            $('.' + name + 'Top').addClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideUp();
        },

        'show': function (name) {
            console.log("--------进入render.show--------------");
            $('.' + name + 'Arrow').removeClass("closed");
            $('.' + name + 'Top').removeClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideDown();
        },

        'removeSubscriptionsMessages': function (id) {
            console.log("--------进入render.removeSubscriptionsMessages--------------");
            websocketclient.messages = _.filter(websocketclient.messages, function (item) {
                return item.subscriptionId != id;
            });
            websocketclient.render.messages();
        },

        'clearMessages': function () {
            console.log("--------进入render.clearMessages--------------");
            $("#messEdit").empty();
        },

        'clearSubscriptions': function () {
            console.log("--------进入render.clearSubscriptions--------------");
            $("#innerEdit").empty();
        }
    }
};
