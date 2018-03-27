/**
 * Copyright (c) 2014, 2017, Oracle and/or its affiliates.
 * The Universal Permissive License (UPL), Version 1.0
 */
/*
 * Your dashboard ViewModel code goes here
 */
define(['ojs/ojcore', 'knockout', 'jquery',
        'persist/persistenceStoreManager',
        'persist/pouchDBPersistenceStoreFactory',
        'persist/persistenceManager',
        'persist/defaultResponseProxy',
        'persist/oracleRestJsonShredding',
        'persist/queryHandlers',
        'persist/impl/logger',
        'viewModels/helpers/employeesHelper',
        'ojs/ojmodel', 'ojs/ojpagingcontrol', 'ojs/ojbutton', 'ojs/ojlistview', 'ojs/ojarraydataprovider',
        'ojs/ojinputtext', 'ojs/ojdialog', 'ojs/ojinputtext', 'ojs/ojlabel'],
 function(oj, ko, $, persistenceStoreManager,
                     pouchDBPersistenceStoreFactory,
                     persistenceManager,
                     defaultResponseProxy,
                     oracleRestJsonShredding,
                     queryHandlers,
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
                queryHandler: queryHandlers.getOracleRestQueryHandler('emp')
            });
            var fetchListener = responseProxy.getFetchEventListener();
            registration.addEventListener('fetch', fetchListener);
          });
      });


      $.ajax({
          url: 'http://host:port/restapp/rest/1/Employees',
          type: 'GET',
          dataType: 'json',
          success: function (data, textStatus, jqXHR) {
            console.log(data);

            self.allItems.removeAll();
            for (i = 0; i < data.count; i++) {
              self.allItems.push({"id": data.items[i].EmployeeId, "item": data.items[i].FirstName});
            }
            console.log('Online: ' + persistenceManager.isOnline());
          },
          error: function (jqXHR, textStatus, errorThrown) {
            console.log('Fetch failed');
          }
      });

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
              self.allItems.push({"id": collection.models[i].attributes.EmployeeId, "item": collection.models[i].attributes.FirstName});
              console.log(collection.models[i].attributes.FirstName);
            }
            console.log('Online: ' + persistenceManager.isOnline());
          }
        });
      }

      self.searchData = function(event) {
        var searchUrl = "http://host:port/restapp/rest/1/Employees?q=FirstName='" + self.searchName() + "'";

        $.ajax({
            url: searchUrl,
            type: 'GET',
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
              console.log(data);

              self.allItems.removeAll();
              for (i = 0; i < data.count; i++) {
                self.allItems.push({"id": data.items[i].EmployeeId, "item": data.items[i].FirstName});
              }
              console.log('Online: ' + persistenceManager.isOnline());
            },
            error: function (jqXHR, textStatus, errorThrown) {
              console.log('Fetch failed');
            }
        });
      }

      self.handleCurrentItemChanged = function(event) {
        self.employeeId(self.selectedItem().data.id);
        self.employeeName(self.selectedItem().data.item);

        document.querySelector('#md1').open();
      }

      self.submitUpdate = function(event) {
        self.employeeModel().save(self.buildEmployeeModel(), {
            contentType: 'application/vnd.oracle.adf.resourceitem+json',
            patch: 'patch',
            success: function (model) {
              console.log('DB UPDATE SUCCESS');
            },
            error: function (jqXHR, textStatus, errorThrown) {}
        });

        for (var i = 0; i < self.allItems().length; i++) {
          if (self.allItems()[i].id === self.employeeId()) {
            self.allItems.splice(i, 1, {"id": self.employeeId(), "item": self.employeeName()});
          }
        }

        document.querySelector('#md1').close();
      }

      self.buildEmployeeModel = function () {
        return {
            'EmployeeId': self.employeeId(),
            'FirstName': self.employeeName()
        };
      };

      self.synchOfflineChanges = function() {
        persistenceManager.getSyncManager().sync().then(function () {
          console.log('DB SYNCH DONE');
          }, function (error) {
            var requestId = error.requestId;
            var response = error.response;
            persistenceManager.getSyncManager().removeRequest(requestId);
          }
        );
      };

      function onlineHandler() {
        self.synchOfflineChanges();
      }

      self.renderer = function(context) {
        return {'insert':context['data']['item']};
      };
    }
    return new DashboardViewModel();
  }
);
