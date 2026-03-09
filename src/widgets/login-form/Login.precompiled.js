(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates['Login.hbs'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<form class=\"login-form\">\r\n    <h2 class=\"form-title\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"title") || (depth0 != null ? lookupProperty(depth0,"title") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"title","hash":{},"data":data,"loc":{"start":{"line":2,"column":27},"end":{"line":2,"column":38}}}) : helper)))
    + "</h2>\r\n\r\n    <div class=\"form-fields\">\r\n    </div>\r\n\r\n    <button type=\"submit\" class=\"accent-btn\" id=\"login-btn\">Зарегистрироваться</button>\r\n    <a class=\"simple-btn\" href=\"\" id=\"register-from-login-btn\">Войти</a>\r\n</form>";
},"useData":true});
})();