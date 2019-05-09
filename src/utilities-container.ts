import { Container } from 'aurelia-dependency-injection';
import { DOM } from 'aurelia-pal';
import { BoundViewFactory, ViewSlot, ViewResources, TargetInstruction, View } from 'aurelia-templating';

function elementContainerGet(this: Container, key: any): any {
  if (key === DOM.Element) {
    return this.element;
  }

  if (key === BoundViewFactory) {
    if (this.boundViewFactory) {
      return this.boundViewFactory;
    }

    let factory = this.instruction.viewFactory;
    let partReplacements = this.partReplacements;

    if (partReplacements) {
      factory = partReplacements[factory.part] || factory;
    }

    this.boundViewFactory = new BoundViewFactory(this, factory, partReplacements);
    return this.boundViewFactory;
  }

  if (key === ViewSlot) {
    if (this.viewSlot === undefined) {
      this.viewSlot = new ViewSlot(this.element, this.instruction.anchorIsContainer);
      this.element.isContentProjectionSource = this.instruction.lifting;
      this.children.push(this.viewSlot);
    }

    return this.viewSlot;
  }

  if (key === ViewResources) {
    return this.viewResources;
  }

  if (key === TargetInstruction) {
    return this.instruction;
  }

  return this.superGet(key);
}


export const createElementContainer = (
  parent: Container,
  element: Element,
  instruction: TargetInstruction,
  children: View[],
  partReplacements: Record<string, any>,
  resources: ViewResources
): Container => {
  const container = parent.createChild();
  const provider = instruction.providers[0];

  container.element = element as Element & { isContentProjectionSource: boolean };
  container.instruction = instruction;
  container.children = children;
  container.viewResources = resources;
  container.partReplacements = partReplacements;

  container.registerSingleton(provider, provider);

  container.superGet = container.get;
  container.get = elementContainerGet;

  return container;
};
