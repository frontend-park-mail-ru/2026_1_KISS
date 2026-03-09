(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates['GreenHeader'] = template({"1":function(container,depth0,helpers,partials,data) {
    var alias1=container.lambda, alias2=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "                <button class=\"base-btn  "
    + alias2(alias1((depth0 != null ? lookupProperty(depth0,"class") : depth0), depth0))
    + "\" data-action=\""
    + alias2(alias1((depth0 != null ? lookupProperty(depth0,"action") : depth0), depth0))
    + "\">\r\n                    "
    + alias2(alias1((depth0 != null ? lookupProperty(depth0,"text") : depth0), depth0))
    + "\r\n                </button>\r\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<header class=\"green-header\">\r\n    <div class=\"header-container\">\r\n        <!-- Логотип с ссылкой на главную -->\r\n        <a href=\"/\" class=\"logo-link\">\r\n            <img src=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"logo") || (depth0 != null ? lookupProperty(depth0,"logo") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"logo","hash":{},"data":data,"loc":{"start":{"line":5,"column":22},"end":{"line":5,"column":30}}}) : helper)))
    + "\" alt=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"title") || (depth0 != null ? lookupProperty(depth0,"title") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"title","hash":{},"data":data,"loc":{"start":{"line":5,"column":37},"end":{"line":5,"column":46}}}) : helper)))
    + " Logo\" class=\"logo-image\">\r\n        </a>\r\n\r\n        <div class=\"header-buttons\">\r\n"
    + ((stack1 = lookupProperty(helpers,"each").call(alias1,(depth0 != null ? lookupProperty(depth0,"buttons") : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":9,"column":12},"end":{"line":13,"column":21}}})) != null ? stack1 : "")
    + "        </div>\r\n    </div>\r\n</header>";
},"useData":true});
templates['Login'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<form class=\"login-form\">\r\n    <h2 class=\"form-title\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"title") || (depth0 != null ? lookupProperty(depth0,"title") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"title","hash":{},"data":data,"loc":{"start":{"line":2,"column":27},"end":{"line":2,"column":38}}}) : helper)))
    + "</h2>\r\n\r\n    <div class=\"form-fields\">\r\n    </div>\r\n\r\n    <button type=\"submit\" class=\"accent-btn\" id=\"login-btn\">Войти</button>\r\n    <a class=\"simple-btn\" href=\"\" id=\"register-from-login-btn\">Зарегистрироваться</a>\r\n</form>";
},"useData":true});
templates['Register'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<form class=\"registration-form\">\r\n    <h2 class=\"form-title\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"title") || (depth0 != null ? lookupProperty(depth0,"title") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"title","hash":{},"data":data,"loc":{"start":{"line":2,"column":27},"end":{"line":2,"column":38}}}) : helper)))
    + "</h2>\r\n\r\n    <div class=\"form-fields\">\r\n    </div>\r\n\r\n    <button type=\"submit\" class=\"accent-btn\" id=\"register-btn\">Зарегистрироваться</button>\r\n    <a class=\"simple-btn\" href=\"\" id=\"go-out-btn\">Войти</a>\r\n</form>";
},"useData":true});
templates['Input'] = template({"1":function(container,depth0,helpers,partials,data) {
    return "input-wrapper_error";
},"3":function(container,depth0,helpers,partials,data) {
    return "input-wrapper_disabled";
},"5":function(container,depth0,helpers,partials,data) {
    return "required";
},"7":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "pattern=\""
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"pattern") || (depth0 != null ? lookupProperty(depth0,"pattern") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"pattern","hash":{},"data":data,"loc":{"start":{"line":9,"column":32},"end":{"line":9,"column":43}}}) : helper)))
    + "\"";
},"9":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "minlength=\""
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"minlength") || (depth0 != null ? lookupProperty(depth0,"minlength") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"minlength","hash":{},"data":data,"loc":{"start":{"line":10,"column":36},"end":{"line":10,"column":49}}}) : helper)))
    + "\"";
},"11":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "maxlength=\""
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"maxlength") || (depth0 != null ? lookupProperty(depth0,"maxlength") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"maxlength","hash":{},"data":data,"loc":{"start":{"line":11,"column":36},"end":{"line":11,"column":49}}}) : helper)))
    + "\"";
},"13":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "-->\r\n<!--        <span class=\"input-hint\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"hint") || (depth0 != null ? lookupProperty(depth0,"hint") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"hint","hash":{},"data":data,"loc":{"start":{"line":17,"column":37},"end":{"line":17,"column":45}}}) : helper)))
    + "</span>-->\r\n<!--    ";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"input-wrapper "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"error") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":1,"column":26},"end":{"line":1,"column":65}}})) != null ? stack1 : "")
    + " "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"disabled") : depth0),{"name":"if","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":1,"column":66},"end":{"line":1,"column":111}}})) != null ? stack1 : "")
    + "\">\r\n    <input\r\n            type=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"type") || (depth0 != null ? lookupProperty(depth0,"type") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"type","hash":{},"data":data,"loc":{"start":{"line":3,"column":18},"end":{"line":3,"column":26}}}) : helper)))
    + "\"\r\n            id=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"id") || (depth0 != null ? lookupProperty(depth0,"id") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data,"loc":{"start":{"line":4,"column":16},"end":{"line":4,"column":22}}}) : helper)))
    + "\"\r\n            value=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"value") || (depth0 != null ? lookupProperty(depth0,"value") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"value","hash":{},"data":data,"loc":{"start":{"line":5,"column":19},"end":{"line":5,"column":28}}}) : helper)))
    + "\"\r\n            placeholder=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"placeholder") || (depth0 != null ? lookupProperty(depth0,"placeholder") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"placeholder","hash":{},"data":data,"loc":{"start":{"line":6,"column":25},"end":{"line":6,"column":40}}}) : helper)))
    + "\"\r\n            class=\"input-field\"\r\n        "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"required") : depth0),{"name":"if","hash":{},"fn":container.program(5, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":8,"column":8},"end":{"line":8,"column":39}}})) != null ? stack1 : "")
    + "\r\n        "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"pattern") : depth0),{"name":"if","hash":{},"fn":container.program(7, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":9,"column":8},"end":{"line":9,"column":51}}})) != null ? stack1 : "")
    + "\r\n        "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"minlength") : depth0),{"name":"if","hash":{},"fn":container.program(9, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":10,"column":8},"end":{"line":10,"column":57}}})) != null ? stack1 : "")
    + "\r\n        "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"maxlength") : depth0),{"name":"if","hash":{},"fn":container.program(11, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":11,"column":8},"end":{"line":11,"column":57}}})) != null ? stack1 : "")
    + "\r\n    />\r\n\r\n    <span class=\"input-error-message\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"error") || (depth0 != null ? lookupProperty(depth0,"error") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"error","hash":{},"data":data,"loc":{"start":{"line":14,"column":38},"end":{"line":14,"column":47}}}) : helper)))
    + "</span>\r\n\r\n<!--    "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"hint") : depth0),{"name":"if","hash":{},"fn":container.program(13, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":16,"column":8},"end":{"line":18,"column":15}}})) != null ? stack1 : "")
    + "-->\r\n</div>";
},"useData":true});
})();