import { Container } from 'aurelia-dependency-injection';
import { ViewCompiler, ViewResources, HtmlBehaviorResource, Controller, behavior } from 'aurelia-templating';
import { ICustomHtmlRegistry, IRootNode, ICustomAttributeInfo } from './interface';
import { createElementContainer } from './utilities-container';
import { createAttributeController, attrNameOf } from './utilities-custom-attribute';
import { CustomElementRegistry } from './registry-custom-element';
import { metadata } from 'aurelia-metadata';
import { Scope } from 'aurelia-binding';

export class CustomAttributeRegistry implements ICustomHtmlRegistry {

  /**@internal */
  static inject = [CustomElementRegistry, Container, ViewCompiler, ViewResources];

  /**@internal */
  _lookup: Map<string, ICustomAttributeInfo>;

  /**
   * A map of all registered attributes in this registry
   * @internal
   */
  _attrNames: string[];

  /**@internal */
  _element_attr_map_map: WeakMap</*element*/Element, Map</*attr name*/string, /*attr vm controller*/Controller>>;

  /**@internal */
  _root_observer_map: WeakMap<IRootNode, MutationObserver>;

  /**@internal */
  _elementRegistry: CustomElementRegistry;

  /**@internal */
  _container: Container;

  /**@internal */
  _viewCompiler: ViewCompiler;

  /**@internal */
  _viewResources: ViewResources;

  constructor(
    elementRegistry: CustomElementRegistry,
    container: Container,
    viewCompiler: ViewCompiler,
    viewResources: ViewResources
  ) {
    this._lookup = new Map();
    this._elementRegistry = elementRegistry;
    this._container = container;
    this._viewCompiler = viewCompiler;
    this._viewResources = viewResources;
    this._element_attr_map_map = new WeakMap();
    this._root_observer_map = new WeakMap();
  }

  register(Type: Function, root: IRootNode = document): Function {
    let htmlBehaviorResource = metadata.get(metadata.resource, Type) as HtmlBehaviorResource;
    // validating metadata
    if (htmlBehaviorResource) {
      ViewResources.convention(Type, htmlBehaviorResource);
    } else {
      htmlBehaviorResource = ViewResources.convention(Type) as HtmlBehaviorResource;
      metadata.define(metadata.resource, htmlBehaviorResource, Type);
    }
    if (!(htmlBehaviorResource instanceof HtmlBehaviorResource) || htmlBehaviorResource.attributeName === null) {
      throw new Error(`class ${Type.name} is already associated with a different type of resource. Cannot register as a custom attribute.`);
    }
    if (!htmlBehaviorResource.isInitialized) {
      htmlBehaviorResource.initialize(this._container, Type);
    }
    this.registerBehavior(htmlBehaviorResource, attrNameOf(htmlBehaviorResource), root);
    return Type;
  }

  /**@internal */
  registerBehavior(behavior: HtmlBehaviorResource, attrName: string, root: IRootNode = document): ICustomAttributeInfo {
    const info: ICustomAttributeInfo = {
      attrName: attrName,
      behavior: behavior,
      classDefinition: behavior.target
    };
    this._lookup.set(attrName, info);
    this.observeRoot(root);
    return info;
  }

  get(attrName: string): ICustomAttributeInfo | undefined {
    return this._lookup.get(attrName);
  }

  has(Type: Function): boolean {
    throw new Error('Method not implemented.');
  }

  /**@internal */
  observeRoot(root: IRootNode) {
    const root_observer_map = this._root_observer_map;
    let root_mutation_observer = root_observer_map.get(root);
    if (root_mutation_observer === undefined) {
      root_mutation_observer = new MutationObserver((entries) => {
        this.handleMutation(entries);
      });
      root_observer_map.set(root, root_mutation_observer);
      root_mutation_observer.observe(
        root,
        { childList: true, attributes: true, subtree: true, attributeOldValue: true }
      );
    }
  }

  /**@internal */
  handleMutation(entries: MutationRecord[]) {
    for (let i = 0, ii = entries.length; ii > i; ++i) {
      const entry = entries[i];
      // if it's attribute mutation
      // upgrade/degrade by using existing controller
      if (entry.type === 'attributes') {
        const attributeName = entry.attributeName!;
        if (this._lookup.get(attributeName) !== undefined) {
          this.handleAttrChange(attributeName, entry.target as Element);
        }
      }
      // else loop through all attributes on the element and upgrade
      else {
        const { addedNodes, removedNodes } = entry;
        for (let i = 0, ii = addedNodes.length; ii > i; ++i) {
          const addedNode = addedNodes[i];
          if (addedNode.nodeType === 1) {
            this.handleElementAdded(addedNode as Element);
          }
        }
        for (let i = 0, ii = removedNodes.length; ii > i; ++i) {
          const removedNode = removedNodes[i];
          if (removedNode.nodeType === 1) {
            this.handleElementRemoved(removedNode as Element);
          }
        }
      }
    }
  }

  /**
   * Target upgrade-able attributes on an element
   * @internal
   */
  handleElementAdded(element: Element): void {
    // 0. get reference to associated behavior of element
    //    this is to check with observedAttributes on an element
    const elementBehavior = this._elementRegistry.get(element.tagName.toLowerCase());
    // 1. store reference to attributes for easy access
    const attributes = element.attributes;
    // 2. store reference to lookup for easy registration check
    const lookup = this._lookup;
    const element_attr_map_map = this._element_attr_map_map;
    let attrMap = element_attr_map_map.get(element);
    if (attrMap === undefined) {
      // 2. create an array to store reference to all interested attribute in this element
      const interestedAttributes: Attr[] = [];
      // 3. loop through current attributes on added element and aggregate custom attributes based on current lookup
      for (let i = 0, ii = attributes.length; ii > i; ++i) {
        const attr = attributes[i];
        if (lookup.get(attr.name) !== undefined) {
          interestedAttributes.push(attr);
        }
      }
      if (interestedAttributes.length > 0) {
        attrMap = new Map();
        element_attr_map_map.set(element, attrMap);
        for (let i = 0, ii = interestedAttributes.length; ii > i; ++i) {
          this.handleAttrChange(interestedAttributes[i].name, element);
        }
      }
    } else {
      if (elementBehavior === undefined) {
        for (let i = 0, ii = attributes.length; ii > i; ++i) {
          const attr = attributes[i];
          const attrName = attr.name;
          // if attribute is not a bindable attribute on custom element
          // and it's a registered attribute
          if (lookup.get(attrName) !== undefined) {
            this.handleAttrChange(attrName, element);
          }
        }
      } else {
        const bindables = elementBehavior.behavior.attributes;
        for (let i = 0, ii = attributes.length; ii > i; ++i) {
          const attr = attributes[i];
          const attrName = attr.name;
          // if attribute is not a bindable attribute on custom element
          // and it's a registered attribute
          if (bindables[attrName] === undefined && lookup.get(attrName) !== undefined) {
            this.handleAttrChange(attrName, element);
          }
        }
      }
    }
  }

  /**
   * Target downgrade-able attributes on an element
   * @internal
   */
  handleElementRemoved(element: Element): void {
    const element_attr_map_map = this._element_attr_map_map;
    let attrMap = element_attr_map_map.get(element);
    if (attrMap === undefined) {
      return;
    }
    attrMap.forEach((controller, attrName) => {
      controller.detached();
      controller.unbind();
    });
  }

  /**@internal */
  handleAttrChange(attrName: string, element: Element): void {
    const elementBehavior = this._elementRegistry.get(element.tagName.toLowerCase());
    // do not act on an Aurelia custom element bindable property/native custom element observed attribute
    if (elementBehavior !== undefined && elementBehavior.behavior.attributes[attrName] !== undefined) {
      return;
    }
    const newValue = element.getAttribute(attrName);
    const element_attr_map_map = this._element_attr_map_map;
    let attrMap = element_attr_map_map.get(element);
    if (attrMap === undefined) {
      attrMap = new Map();
      element_attr_map_map.set(element, attrMap);
    }
    let controller = attrMap.get(attrName);
    const wasRemoved = newValue === null;
    if (wasRemoved) {
      if (controller === undefined) {
        return;
      } else {
        controller.detached();
        controller.unbind();
      }
    } else {
      // if there is no controller associated with element for a given
      if (controller === undefined) {
        controller = this.createAttrController(attrName, element);
        const scope: Scope = { bindingContext: {}, overrideContext: null! };
        (controller.viewModel as any).value = newValue;
        controller.bind(scope);
        controller.attached();
      }
      // else, just need to assign new value and let view model handle change
      else {
        (controller.viewModel as any).value = newValue;
      }
    }
  }

  /**@internal */
  createAttrController(attrName: string, element: Element) {
    return createAttributeController(
      attrName,
      element,
      this._container,
      this._lookup.get(attrName)!.behavior,
      this._viewCompiler,
      this._viewResources
    );
  }
}
