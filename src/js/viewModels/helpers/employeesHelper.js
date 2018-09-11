define(['ojs/ojcore', 'knockout'], function (oj, ko) {

    function EmployeesHelperViewModule() {
        var self = this;
        var urlEmployees = "http://138.68.79.219:7001/restapp/rest/1/Employees";

        self.createEmployeeModel = function () {
            var EmployeeModel = oj.Model.extend({
                urlRoot: urlEmployees,
                idAttribute: "EmployeeId"
            });

            return new EmployeeModel();
        };

        self.createEmployeesCollection = function () {
            var EmployeesCollection = oj.Collection.extend({
                customURL: getURL,
                model: this.createEmployeeModel()
            });

            function getURL(operation, collection, options) {
                var url = urlEmployees;

                if (options.fetchSize !== undefined) {
                    url += "?limit=" + options.fetchSize;
                    sawOpt = true;
                }

                if (options.startIndex !== undefined) {
                    url += "&offset=" + options.startIndex;
                }

                return {'url': url};
            }

            return new EmployeesCollection();
        };

        self.getEmployeesEndpointURL = function () {
          return urlEmployees;
        }
    }

    return new EmployeesHelperViewModule();
});
