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
        'ojs/ojmodel', 'ojs/ojpagingcontrol', 'ojs/ojbutton', 'ojs/ojlistview', 'ojs/ojarraydataprovider',
        'ojs/ojinputtext'],
 function(oj, ko, $, persistenceStoreManager,
                     pouchDBPersistenceStoreFactory,
                     persistenceManager,
                     defaultResponseProxy,
                     oracleRestJsonShredding,
                     queryHandlers) {

    function DashboardViewModel() {
      var self = this;

      self.searchName = ko.observable();

      self.allItems = ko.observableArray();
      self.dataProvider = new oj.ArrayDataProvider(self.allItems, {'idAttribute': 'id'});

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

      self.fetchData = function(event) {
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

      self.renderer = function(context) {
        return {'insert':context['data']['item']};
      };
    }
    return new DashboardViewModel();
  }
);
