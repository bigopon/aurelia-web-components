import { Container, autoinject } from 'aurelia-dependency-injection';
import { BehaviorInstruction, HtmlBehaviorResource, TargetInstruction, ViewCompiler, ViewResources, Controller } from 'aurelia-templating';
import { createElementContainer } from './utilities-container';
import { ObserverLocator } from 'aurelia-binding';
import { IGetterFunction } from './interface';

export const attrNameOf = (htmlBehavior: HtmlBehaviorResource) => htmlBehavior.attributeName || htmlBehavior.target.name;

const noExpressions = Object.freeze([]) as unknown as any[];

export const createAttributeController = (
  attrName: string,
  element: Element,
  container: Container,
  behavior: HtmlBehaviorResource,
  compiler: ViewCompiler,
  viewResources: ViewResources
): Controller => {

  const behaviorInstruction = BehaviorInstruction.attribute(attrName, behavior);
  // const attributes = element.attributes;
  const children = [];
  const bindings = [];

  // behavior.processAttributes(compiler, viewResources, element, attributes, behaviorInstruction);

  // for (let i = 0, ii = attributes.length; i < ii; ++i) {
  //   const attr = attributes[i];
  //   behaviorInstruction.attributes[attr.name] = attr.value;
  // }

  // behavior.compile(compiler, viewResources, element, behaviorInstruction, element.parentNode!);

  const targetInstruction = TargetInstruction.normal(
    0,
    0,
    [behavior.target],
    [behaviorInstruction],
    /*no expression*/noExpressions,
    behaviorInstruction
  );

  const childContainer = createElementContainer(
    container,
    element,
    targetInstruction,
    children,
    behaviorInstruction.partReplacements,
    viewResources
  );

  const controller = behavior.create(childContainer, behaviorInstruction, element, bindings);
  // const viewModel = controller.viewModel;
  // const lookup = container.get(ObserverLocator).getOrCreateObserversLookup(viewModel);
  // behavior._ensurePropertiesDefined(viewModel, lookup);
  // const valueObserver = lookup['value'];
  // const valuePropertyDescription = {
  //   get() {
  //     return valueObserver.getValue();
  //   },
  //   set(val: any) {
  //     valueObserver.setValue(val);
  //   }
  // };
  // (valuePropertyDescription.get as IGetterFunction).getObserver = function() {
  //   return valueObserver;
  // };
  // Reflect.defineProperty(viewModel, 'value', valuePropertyDescription);
  controller.created(null!);
  return controller;
};
