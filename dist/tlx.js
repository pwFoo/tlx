(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
	const tlx = require("./src/tlx-core.js");
	require("./src/tlx-vtdom.js")(tlx);
	require("./src/tlx-reactive.js")(tlx);
	require("./src/tlx-directives.js")(tlx);
	//require("./src/tlx-sanitize.js");
})();
},{"./src/tlx-core.js":2,"./src/tlx-directives.js":3,"./src/tlx-reactive.js":4,"./src/tlx-vtdom.js":5}],2:[function(require,module,exports){
(function() {
	"use strict"
	/* Copyright 2017,2018, AnyWhichWay, Simon Y. Blackwell, MIT License
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	const booleanAttribute = ["checked","disabled","hidden","multiple","nowrap","selected","required"],
		createNode = (vnode,node,parent,options) => {
			const type = typeof(vnode);
			let append;
			if(type==="function") {
				vnode(node)
			} if(vnode && type==="object") {
				if(!node) {
					node = append = document.createElement(vnode.nodeName);
				} else if(node.nodeName.toLowerCase()!==vnode.nodeName) {
					const newnode = document.createElement(vnode.nodeName);
					node.parentNode.replaceChild(newnode,node);
					node = newnode;
				}
				if(node.attributes) {
					const remove = [];
					for(let i=0;i<node.attributes.length;i++) {
						const attribute = node.attributes[i];
						if(!vnode.attributes[attribute.name]) remove.push(attribute.name);
					}
					while(remove.length>0) node.removeAttribute(remove.pop());
				}
				if(options.protect) tlx.protect(node,typeof(options.protect)==="function" ? options.protect : tlx.cleaner);
				setAttributes(node,vnode,options);
				while(node.childNodes.length>vnode.children.length) node.removeChild(node.lastChild);
				vnode.children.forEach((child,i) => {
					if(child) createNode(child,node.childNodes[i],node,options);
				});
			} else {
				if(!node) {
					node = append = new Text(vnode);
				} else if(node instanceof Text){
					if(node.data!==vnode) node.data = vnode;
				} else {
					parent = node;
					append = new Text(vnode);
				}
			}
			if(parent && append) parent.appendChild(append);
			return node;
		},
		different = (o1,o2) => {
			const t1 = typeof(o1),
				t2 = typeof(o2);
			if(t1!==t2) return true;
			if(t1!=="object") return o1!==o2;
			return Object.keys(o1).some(key => different(o1[key],o2[key])) || Object.keys(o2).some(key => different(o1[key],o2[key]));
		},
		falsy = value => !value || (typeof(value)==="string" && (value==="false" || value==="0")),
		h = (nodeName,attributes={},children=[]) => {
			if(typeof(tlx.customElements)!=="undefined") {
				const template = document.querySelector(`template[t-tagname=${nodeName}]`);
				if(template) tlx.customElements[nodeName] = tlx.compile(template);
				if(tlx.customElements[nodeName]) {
					const node = new tlx.customElements[nodeName](attributes);
					if(node instanceof Node) return vtdom(node);
					if(typeof(node)==="function") return node;
					if(node.nodeName) {
						node.attributes || (node.attributes={});
						node.children || (node.children=[]);
						return node;
					}
					throw new TypeError(`Custom element constructor for '${nodeName}' must return a Node or a virtual node`);
				}
			}
			return {nodeName,attributes,children}; 
		},
		mvc = function(config={template:document.body.firstElementChild.outerHTML},target=document.body.firstElementChild,options={}) {
			let {model={},view,controller=model,template} = config;
			if(!target || !(target instanceof Node)) throw new TypeError("tlx.mvc or tlx.app target must be DOM Node");
			options = Object.assign({},tlx.defaults,options);
			if(options.protect) {
				if(!tlx.escape) throw new Error("tlx options.protect is true, but tlx.escape is null");
				if(typeof(window)!=="undefined") 
					if(typeof(options.protect)==="function") tlx.protect(window,options.protect);
					else tlx.protect(window);
			}
			if(!template && !view) throw new TypeError("tlx.mvc must specify a view or template");
			if(!view && template) {
				if(!tlx.vtdom) throw new Error("tlx-vtdom.js must be loaded to use templates.")
				const scope = {};
				Object.defineProperty(scope,"model",{value:model});
				Object.defineProperty(scope,"controller",{value:controller});
				view = (model,controller) => tlx.vtdom(template,scope);
			}
			const proxy = wire(model,view,controller,target,options);
			while(target.lastChild) target.removeChild(target.lastChild);
			controller.render = proxy.render;
			controller.render.reactive = options.reactive;
			controller.render.partials = options.partials;
			proxy.render(model,true);
			return proxy;
		},
		realize = (vnode,target,parent,options) => { //target,parent
			const type = typeof(vnode.valueOf());
			if(target) {
				return createNode(vnode,target,parent,options);
			}
		},
		setAttributes = (element,vnode,options) => {
			for(const aname in vnode.attributes) {
				const value  = vnode.attributes[aname];
				if(aname==="style" && value && typeof(value)==="object") value = Object.keys(value).reduce((accum,key) => accum += `${key}:${value};`);
				if(!booleanAttribute.some(name => name===aname && falsy(value))) {
					const type = typeof(value);
					if(type==="function" || (value && type==="object") || aname==="t-template") element[aname] = value;
					else {
						if(options.protect && aname==="value") tlx.escape(value);
						element.setAttribute(aname,value);
						if(["checked","selected","value"].includes(aname) && element[aname]!==value) element[aname] = value;
					}
				}
			}
			if(vnode.key && !vnode.attributes.id) element.id = vnode.key;
			return element;
		},
		wire = (model,view,controller,target,options) => {
			let updating;
			const state = target["t-state"] || (target["t-state"] = {}),
				render = function render(newState=model,force) {
					Object.assign(state,newState);
					if(force) {
						if(updating) updating = clearTimeout(updating);
						target = realize(view(model,proxy),target,target.parentNode,options);
					} else if(!updating) {
						updating = setTimeout((...args) => { 
								target = realize(...args);
								updating = false; 
							},
							0,
							view(model,proxy),target,target.parentNode,options);
					}
				},
				proxy = new Proxy(controller,{
					get(target,property) {
						if(property==="render") return render;
						const value = target[property],
							type = typeof(value);
						if(type==="function") {
							// return a wrapper function so that every time a controller function is called
							// the prior state and new state are compared and the view is re-rendered if changed
							return function(...args) {
								let compare = state;
								const result = value.call(options.partials ? null : model,...args);
								while(typeof(result)==="function") result = result(model,controller);
								if(result && typeof(result.then)==="function") {
									result.then((result) => {
										if(options.partials) compare = result;
										if(different(compare,model)) render(model);  
									});
								} else {
									if(options.partials) Object.assign(model,result);
									if(different(compare,model)) render(model); 
								}
							}
						}
						if(value && type==="object") {
							state[property]!==undefined || (state[property]={});
							model[property]!==undefined || (model[property]={});
							return wire(state[property],model[property],value,options);
						}
						return value;
					}
				});
				target["t-controller"] = controller;
				Object.defineProperty(target,"render",{enumerable:false,configurable:true,writable:true,value:render});
				return proxy;
		};
	
	const tlx = {};
	tlx.app = (model,actions,view,target) => tlx.mvc({model,view,controller:actions},target,{reactive:true,partials:true});
	tlx.defaults = {};
	tlx.different = different;
	tlx.falsy = falsy;
	tlx.truthy = value => !falsy(value);
	tlx.h = h;
	tlx.mvc = mvc;
	
	if(typeof(module)!=="undefined") module.exports = tlx;
	if(typeof(window)!=="undefined") window.tlx = tlx;
}).call(this);

},{}],3:[function(require,module,exports){
(function() {
	"use strict"
	/* Copyright 2017,2018, AnyWhichWay, Simon Y. Blackwell, MIT License
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	const directives = {
			"t-if": function(vnode,node,value) {
				return tlx.truthy(value);
			},
			"t-foreach": (vnode,node,items) => {
				vnode.children = [];
				if(Array.isArray(items)) {
					items.forEach((value,index,array) => {
						for(const child of node.childNodes) {
							const vdom = tlx.vtdom(child,{currentValue:value,value,index,array});
							if(vdom) vnode.children.push(vdom);
						}
					});
				} else {
					Object.keys(items).forEach((key,index,object) => {
						const value = items[key];
						for(const child of node.childNodes) {
							const vdom = tlx.vtdom(child,{currentValue:value,key,value,index,object});
							if(vdom) vnode.children.push(vdom);
						}
					});
				}
			},
			"t-for": function(vnode,node,spec) {
				const inIndex = spec.indexOf(" in")>=0 ? spec.indexOf(" in") : Infinity,
						ofIndex = spec.indexOf(" of")>=0 ? spec.indexOf(" of") : Infinity,
						i = Math.min(inIndex,ofIndex);
				if(i===Infinity) throw new TypeError(`Malformed t-for spec '${spec}'`);
				vnode.children = [];
				const	type = i===inIndex ? "in" : "of",
						vname = spec.substring(0,i).trim(),
						target = spec.substring(i+3,spec.length).trim();
				let value;
				try {
					value = Function("return " + target).call(null);
					if(type==="of") {
						for(const item of value) {
							for(const child of node.childNodes) {
								const vdom = tlx.vtdom(child,{[vname]:item,value});
								if(vdom) vnode.children.push(vdom);
							}
						}
					} else {
							for(const item in value) {
								for(const child of node.childNodes) {
									const vdom = tlx.vtdom(child,{[vname]:item,key:item});
									if(vdom) vnode.children.push(vdom);
								}
							}
					}		
				} catch(e) {
					throw new TypeError(`Malformed t-for spec '${spec}'`);
				}
			},
			"t-on": function(vnode,node,spec) {
				for(const key in spec) {
					vnode.attributes["on"+key] = spec[key];
				}
				return true;
			}
	};
	directives["@"] = directives["t-on"];
	tlx.directive = (key,f) => directives[key] = f;
	if(typeof(module)!=="undefined") module.exports = (tlx) => tlx.directives = directives;
	if(typeof(window)!=="undefined") tlx.directives = directives;
}).call(this)
},{}],4:[function(require,module,exports){
(function(tlx) {
	"use strict";
	HTMLElement.prototype.linkState = function(property) {
		const f = function(event) {
			const target = event.target;
			if([HTMLInputElement,HTMLTextAreaElement,HTMLSelectElement,HTMLAnchorElement].some(cls => target instanceof cls)) {
				let value;
				if(target.type==="checkbox") {
					value = target.checked;
				}
				else if(target.type==="select-multiple") {
					value = [];
					for(let option of [].slice.call(target.options)) {
						!option.selected || value.push(tlx.fromJSON(option.value));
					}
				} else {
					value = tlx.fromJSON(target.value);
				}
				const parts = property.split(".");
				let state = this;
				property = parts.pop(); // get final property
				for(let key of parts) {
					state = state[key] || {};
				} // walk tree
				state[property] = value; // set property
			}
		};
		return f.bind(tlx.getState(this)||(this.state={}));
	};
	HTMLElement.prototype.setState = function(state) {
		this.state || (tlx.options.active ? tlx.activate({}) : {});
		Object.assign(this.state,state);
	};
	tlx.activate = (object) => {
		if(!object || typeof(object)!=="object" || object.tlxDependents) {
			return object;
		}
		const dependents = {},
			proxy = new Proxy(object,{
				get: (target,property) => {
					if(property==="tlxDependents") {
						return dependents;
					}
					const value = target[property],
						type = typeof(value);
					if(tlx._NODE && type!=="function" && type!=="undefined") {
						dependents[property] || (dependents[property] = new Set());
						dependents[property].add(tlx._NODE);
					}
					return value;
				},
				set: (target,property,value) => {
					const oldvalue = target[property];
					if(oldvalue!==value) {
						const type = typeof(value);
						!value || type!=="object" || value.tlxDependents || (value = tlx.activate(value));
						if(typeof(oldvalue)===type==="object") {
							const olddependents = oldvalue.tlxDependents,
								newdependents = value.tlxDependents;
							if(olddependents) {
								for(let key in olddependents) {
									newdependents[key] = olddependents[key];
								}
							}
						}
						target[property] = value;
						if(dependents[property]) {
							for(let dependent of dependents[property]) {
								if(!dependent.ownerElement && !dependent.parentElement) {
									dependents[property].delete(dependent);
								} else {
									dependent.vnode.node = dependent;
									tlx.render(dependent.vnode);
									dependent.vnode.node = null;
								}
							}
						}
					}
					return true;
				}
			});
		for(let key in object) {
			object[key] = tlx.activate(object[key]);
		}
		return proxy;
	};
	tlx.getState = (node) => { // force resolution of parent states first
		if(!node) {
			return;
		}
		if(node.state) {
			return node.state;
		}
		return tlx.getState(node.parentElement||node.ownerElement);
	};
	tlx.options || (tlx.options={});
	tlx.options.reactive = true;
		
}(tlx));
},{}],5:[function(require,module,exports){
(function() {
	const bind = (model,element=(typeof(document)!=="undefined" ? document.body.firstElementChild : null),options) => {
		if(typeof(element)==="string") element = document.querySelector(element);
		if(!element) throw new TypeError("null element passed to tlx.bind");
		options = Object.assign({},tlx.defaults,options);
		const controller = tlx.mvc({model,template:element.outerHTML},element,options);
		if(options.reactive) {
			return new Proxy(model,{
				set(target,property,value) {
					target[property] = value;
					controller.render();
				}
			})
		}
		return model;
	 },
	 clone = (data) => {
			if(Array.isArray(data)) {
				const result = [];
				for(const key of data) {
					const value = clone(data[key]);
					if(value!==undefined) result.push(value);
				}
				return result;
			} 
			if(data && typeof(data)==="object") {
				const result = Object.create(Object.getPrototypeOf(data)); //{};
				for(const key in data) {
					const value = clone(data[key]);
					if(value!==undefined) result[key] = value;
				}
				return result;
			}
			return data;
		},
		domParser = new DOMParser(),
		parse = (strings,...values) => {
			if(strings[0]==="" && strings[1]==="" && values.length===1) return values[0]===undefined ? "" : values[0];
			if(values.length===0) return strings[0];
			return strings.reduce((html,string,i) => html += string + (i<strings.length-1 ? (typeof(values[i])==="string" ? values[i] : (values[i]===undefined ? "" : JSON.stringify(values[i]))) : ""),"");
		},
		vtdom = (data,scope,classes,skipResolve) => {
			const resolve = value => {try { return scope && !skipResolve ? Function("p","with(this) { with(this.model||{}) { return p`" + value + "`; }}").call(scope,parse) : value } catch(e) { return value; }},
				vnode = (() => {
					const type = typeof(data);
					let node = data;
					if(type==="string") {
						const doc = domParser.parseFromString(data,"text/html");
						node = doc.body.childNodes[0];
					} else if(!node || type!=="object" || !(node instanceof Node)) throw new TyperError("Argument to tlx.vtdom must be string or object");
					
					if(node instanceof Text) return resolve(node.data);
					
					const attributes = {};
					for(const attr of node.attributes) {
						let value = resolve(attr.value);
						if(typeof(value)==="function") {
							const render = scope.controller ? scope.controller.render : scope.render,
								partials = render ? render.partials : false,
								model = partials ? clone(scope.model||scope) : scope.model||scope,
								f = value.bind(model),
								current = clone(model),
								update = (partial) => {
									if(partials) Object.assign(scope.model||scope,partial);
									if(tlx.different(current,scope.model||scope) && render) render();
								};
							Object.defineProperty(model,"update",{enumerable:false,configurable:true,writable:true,value:update});
							value = (...args) => { update(f(...args)); };
						}
						attributes[attr.name] =  value;
					}
					if(classes) {
						if(attributes.class) attributes.class += " " + classes;
						else attributes.class = classes;
					}
					attributes["t-template"] = node.outerHTML; //"<div>"+node.innerHTML+"</div>";
					
					const vnode = tlx.h(node.tagName.toLowerCase(),attributes);
					if(typeof(vnode)!=="function") {
						if(node.id) vnode.key = node.id;
						if(!skipResolve) {
							for(const aname in vnode.attributes) {
								if(aname==="t-state" || (tlx.directives && tlx.directives[aname])) {
									let value = vnode.attributes[aname];
									if(!Array.isArray(value) && value && typeof(value)==="object" && scope && typeof(scope)==="object") value = Object.assign({},scope,value);
									if(aname==="t-state") {
										if(scope.model) Object.assign(scope.model,value);
										else Object.assign(scope,value);
									} else {
										const next = tlx.directives[aname](vnode,node,value);
										if(!next) return vnode;
									}
								}
							}
						}
						for(const child of node.childNodes) {
							if(child instanceof Text) {
								const value = resolve(child.data);
								vnode.children.push(typeof(value)==="string" ? value : JSON.stringify(value));
							} else if(child.nodeName!=="SCRIPT"){
								vnode.children.push(vtdom(child,scope,classes,skipResolve));
							}
						}
					}
					return vnode;
				})();
			return vnode;
		};
	if(typeof(module)!=="undefined") module.exports = (tlx) => { tlx.vtdom = vtdom; tlx.bind = bind; }
	if(typeof(window)!=="undefined") tlx.vtdom = vtdom; tlx.bind = bind;
}).call(this)
},{}]},{},[1]);
