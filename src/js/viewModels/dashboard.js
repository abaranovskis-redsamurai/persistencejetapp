/**
 * Copyright (c) 2014, 2017, Oracle and/or its affiliates.
 * The Universal Permissive License (UPL), Version 1.0
 */
/*
 * Your dashboard ViewModel code goes here
 */
define(['ojs/ojcore', 'knockout', 'jquery',
        'offline/persistenceStoreManager',
        'offline/pouchDBPersistenceStoreFactory',
        'offline/persistenceManager',
        'offline/defaultResponseProxy',
        'offline/oracleRestJsonShredding',
        'offline/queryHandlers',
        'offline/persistenceUtils',
        'offline/impl/logger',
        'viewModels/helpers/employeesHelper',
        'ojs/ojmodel', 'ojs/ojpagingcontrol', 'ojs/ojbutton', 'ojs/ojlistview', 'ojs/ojarraydataprovider',
        'ojs/ojinputtext', 'ojs/ojdialog', 'ojs/ojinputtext', 'ojs/ojlabel'],
 function(oj, ko, $, persistenceStoreManager,
                     pouchDBPersistenceStoreFactory,
                     persistenceManager,
                     defaultResponseProxy,
                     oracleRestJsonShredding,
                     queryHandlers,
                     persistenceUtils,
                     logger,
                     empls) {

    function DashboardViewModel() {
      var self = this;

      window.addEventListener('online',  onlineHandler);

      var offsetVal = 0;

      self.searchName = ko.observable();

      self.allItems = ko.observableArray();
      self.dataProvider = new oj.ArrayDataProvider(self.allItems, {'idAttribute': 'id'});
      self.selectedItem = ko.observable();
      self.employeeModel = ko.observable();
      self.employeeId = ko.observable();
      self.employeeName = ko.observable();
      self.changeIndicatorAttr = ko.observable();
      self.onlineConflictResolutionTitle = ko.observable();

      var synchErrorRequestId;
      var synchErrorChangeIndicatorAttr;

      self.employeeModel(empls.createEmployeeModel());

      logger.option('level',  logger.LEVEL_LOG);

      persistenceStoreManager.registerDefaultStoreFactory(pouchDBPersistenceStoreFactory);

      persistenceManager.init().then(function() {
        persistenceManager.register({scope: '/Employees'})
          .then(function(registration) {
            var responseProxy = defaultResponseProxy.getResponseProxy({
                jsonProcessor: {
                    shredder: oracleRestJsonShredding.getShredder('emp', 'EmployeeId'),
                    unshredder: oracleRestJsonShredding.getUnshredder()
                },
                queryHandler: queryHandlers.getOracleRestQueryHandler('emp'),
                requestHandlerOverride: {handlePatch: customHandlePatch}
            });
            var fetchListener = responseProxy.getFetchEventListener();
            registration.addEventListener('fetch', fetchListener);

            // initial data load
            self.fetchData();
          });

          // handles response data after synch
          persistenceManager.getSyncManager().addEventListener('syncRequest', self.afterRequestListener,  '/Employees' );
      });

      // invoked, while PATCH executed in offline mode - updating local cache, to allow offline search
      var customHandlePatch = function(request) {
          if (!persistenceManager.isOnline()) {
              persistenceUtils.requestToJSON(request).then(function (data) {
                  var requestData = JSON.parse(data.body.text);

                  persistenceStoreManager.openStore('emp').then(function (store) {
                    store.findByKey(requestData.EmployeeId).then(function (data) {
                      data.FirstName = requestData.FirstName;
                      data.ChangeIndicatorAttr = requestData.ChangeIndicatorAttr;

                      store.upsert(requestData.EmployeeId, JSON.parse('{}'), data);
                    })
                  });
              })

              var init = {'status': 503, 'statusText': 'Edit will be processed when online'};
              return Promise.resolve(new Response(null, init));
          } else {
            return persistenceManager.browserFetch(request);
          }
      };

      self.fetchNext = function(event) {
        offsetVal = offsetVal + 5;
        self.fetchData();
      }

      self.fetchPrevious = function(event) {
        if (offsetVal > 0) {
          offsetVal = offsetVal - 5;
        }
        self.fetchData();
      }

      self.fetchData = function() {
        empls.createEmployeesCollection().fetch({
          startIndex: offsetVal,
          fetchSize: 5,
          success:function (collection, response, options) {
            self.allItems.removeAll();
            for (i = 0; i < collection.size(); i++) {
              self.allItems.push({"id": collection.models[i].attributes.EmployeeId, "firstName": collection.models[i].attributes.FirstName,
                                  "lastName": collection.models[i].attributes.LastName, "email": collection.models[i].attributes.Email,
                                  "phoneNumber": collection.models[i].attributes.PhoneNumber,
                                  "changeIndicatorAttr": collection.models[i].attributes.ChangeIndicatorAttr});
            }
          }
        });
      }

      self.searchData = function(event) {
        if (self.searchName()) {
          var searchUrl = empls.getEmployeesEndpointURL() + "?q=FirstName='" + self.searchName() + "'";

          $.ajax({
              url: searchUrl,
              type: 'GET',
              dataType: 'json',
              success: function (data, textStatus, jqXHR) {
                self.allItems.removeAll();
                for (i = 0; i < data.count; i++) {
                  self.allItems.push({"id": data.items[i].EmployeeId, "firstName": data.items[i].FirstName,
                                      "lastName": data.items[i].LastName, "email": data.items[i].Email,
                                      "phoneNumber": data.items[i].PhoneNumber,
                                      "changeIndicatorAttr": data.items[i].ChangeIndicatorAttr});
                }
              },
              error: function (jqXHR, textStatus, errorThrown) {
                console.log('Fetch failed');
              }
          });
        } else {
          self.fetchData();
        }
      }

      self.handleCurrentItemChanged = function(event) {
        if (self.selectedItem().data) {
          self.employeeId(self.selectedItem().data.id);
          self.employeeName(self.selectedItem().data.firstName);
          self.changeIndicatorAttr(self.selectedItem().data.changeIndicatorAttr);

          document.querySelector('#md1').open();
        }
      }

      self.submitUpdate = function(event) {
        console.log('Online: ' + persistenceManager.isOnline());

        self.employeeModel().save(self.buildEmployeeModel(), {
            contentType: 'application/vnd.oracle.adf.resourceitem+json',
            patch: 'patch',
            success: function (model) {
              console.log('UPDATE SUCCESS');

              for (var i = 0; i < self.allItems().length; i++) {
                if (self.allItems()[i].id === self.employeeId()) {
                  self.allItems.splice(i, 1, {"id": self.allItems()[i].id, "firstName": self.employeeName(),
                                              "lastName": self.allItems()[i].lastName, "email": self.allItems()[i].email,
                                              "phoneNumber": self.allItems()[i].phoneNumber,
                                              "changeIndicatorAttr": model.attributes.ChangeIndicatorAttr});
                  break;
                }
              }
            },
            error: function (jqXHR, textStatus, errorThrown) {
              console.log('UPDATE ISSUE: ' + errorThrown);

              if (jqXHR.status == 409) {
                // conflict
                var firstNameAttr = jqXHR.responseJSON.FirstName;
                var changeIndicatorAttr = jqXHR.responseJSON.ChangeIndicatorAttr;

                for (var i = 0; i < self.allItems().length; i++) {
                  if (self.allItems()[i].id === self.employeeId()) {
                    self.onlineConflictResolutionTitle('Conflict resolution: ' + firstNameAttr);
                    self.changeIndicatorAttr(changeIndicatorAttr);

                    $("#md2").ojDialog("open");
                    break;
                  }
                }
              }

              for (var i = 0; i < self.allItems().length; i++) {
                if (self.allItems()[i].id === self.employeeId()) {
                  self.allItems.splice(i, 1, {"id": self.allItems()[i].id, "firstName": self.employeeName(),
                                              "lastName": self.allItems()[i].lastName, "email": self.allItems()[i].email,
                                              "phoneNumber": self.allItems()[i].phoneNumber,
                                              "changeIndicatorAttr": self.allItems()[i].changeIndicatorAttr});
                  break;
                }
              }
            }
        });

        document.querySelector('#md1').close();
      }

      self.buildEmployeeModel = function () {
        return {
            'EmployeeId': self.employeeId(),
            'FirstName': self.employeeName(),
            'ChangeIndicatorAttr': self.changeIndicatorAttr()
        };
      };

      self.synchOfflineChanges = function() {
        persistenceManager.getSyncManager().getSyncLog().then(async function (data) {
            for (var i = 0; i < data.length; i++) {
              if (data[i].request.method === 'GET') {
                // skip GET requests in sequential loop
                var requestId = data[i].requestId;

                await new Promise(next=> {
                  persistenceManager.getSyncManager().removeRequest(requestId).then(function (request) {
                    console.log('SYNCH CANCELLED FOR GET REQUEST: ' + request.url);
                    next();
                  });
                });
              }
            }

            persistenceManager.getSyncManager().sync({preflightOptionsRequest: 'disabled'}).then(function () {
              console.log('SYNCH DONE');
              }, function (error) {
                var statusCode = error.response.status;

                if (statusCode == 409) {
                  // conflict during offline data synch
                  $("#md3").ojDialog("open");

                  synchErrorRequestId = error.requestId;

                  var response = error.response;
                  response.json().then(function (value) {
                     self.onlineConflictResolutionTitle('Conflict resolution: ' + value.FirstName);
	                   synchErrorChangeIndicatorAttr = value.ChangeIndicatorAttr;
	                });
                }
              }
            );
          }, function (error) {
            var statusCode = error.response.status;
            console.log(statusCode);
          }
        );
      };

      self.afterRequestListener = function (event) {
        // invoked if offline synch for request for success, to bring back values updated in backend
        var statusCode = event.response.status;
        if (statusCode ==  200) {
           event.response.json().then(function(response) {
             var id = response.EmployeeId;
             var changeIndicatorAttr = response.ChangeIndicatorAttr;

             for (var i = 0; i < self.allItems().length; i++) {
               if (self.allItems()[i].id === id) {
                 self.allItems.splice(i, 1, {"id": self.allItems()[i].id, "firstName": self.allItems()[i].firstName,
                                             "lastName": self.allItems()[i].lastName, "email": self.allItems()[i].email,
                                             "phoneNumber": self.allItems()[i].phoneNumber,
                                             "changeIndicatorAttr": changeIndicatorAttr});
                 console.log('UPDATE SUCCESS IN SYNCH FOR: ' + id + ', WITH NEW CHANGE INDICATOR: ' + changeIndicatorAttr);
                 break;
               }
             }
           });
        }

        return Promise.resolve({action: 'continue'});
      }

      self.applyClientChangesToServer = function(event) {
        self.submitUpdate();
        $("#md2").ojDialog("close");
      }

      self.cancelClientChangesToServer = function(event) {
        $("#md2").ojDialog("close");

        var searchUrl = empls.getEmployeesEndpointURL() + "/" + self.employeeId();
        self.refreshEntry(searchUrl);
      }

      self.applyOfflineClientChangesToServer = function(event) {
        persistenceManager.getSyncManager().removeRequest(synchErrorRequestId).then(function (request) {
          $("#md3").ojDialog("close");

          persistenceUtils.requestToJSON(request).then(function (requestData) {
            var requestPayload = JSON.parse(requestData.body.text);
            requestPayload.ChangeIndicatorAttr = synchErrorChangeIndicatorAttr;
            requestData.body.text = JSON.stringify(requestPayload);

            persistenceUtils.requestFromJSON(requestData).then(function (request) {
              persistenceManager.getSyncManager().insertRequest(request).then(function () {
                self.synchOfflineChanges();
              });
            });
          });
        });
      }

      self.cancelOfflineClientChangesToServer = function(event) {
        persistenceManager.getSyncManager().removeRequest(synchErrorRequestId).then(function (request) {
          $("#md3").ojDialog("close");

          persistenceUtils.requestToJSON(request).then(function (requestData) {
            var requestPayload = JSON.parse(requestData.body.text);
            var employeeId = requestPayload.EmployeeId;

            var searchUrl = empls.getEmployeesEndpointURL() + "/" + employeeId;
            self.refreshEntry(searchUrl);
          });

          self.synchOfflineChanges();
        });
      }

      self.refreshEntry = function(searchUrl) {
        $.ajax({
            url: searchUrl,
            type: 'GET',
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
              for (var i = 0; i < self.allItems().length; i++) {
                if (self.allItems()[i].id === data.EmployeeId) {
                  self.allItems.splice(i, 1, {"id": data.EmployeeId, "firstName": data.FirstName,
                                              "lastName": data.LastName, "email": data.Email,
                                              "phoneNumber": data.PhoneNumber,
                                              "changeIndicatorAttr": data.ChangeIndicatorAttr});

                  break;
                }
              }
            },
            error: function (jqXHR, textStatus, errorThrown) {
              console.log('Fetch failed');
            }
        });
      }

      function onlineHandler() {
        self.synchOfflineChanges();
      }
    }
    return new DashboardViewModel();
  }
);
