export class ViewModel {
  constructor() {
    this.containersIds = [];
    this.templates = {};
    this.viewData = {};
  }

  initializeTemplates() {
    let templates = [...document.querySelectorAll('script[type="text/x-handlebars"]')];
    templates.forEach(template => {
      this.compileTemplate(template);
      this.registerAsPartial(template);
    });
  }

  compileTemplate(template) {
    let id = template.id;
    this.templates[id] = Handlebars.compile(template.innerHTML);
  }

  registerAsPartial(template) {
    let id = template.id;
    Handlebars.registerPartial(id, template.innerHTML);
  }

  registerContainers(selector) {

    let containers = [...document.querySelectorAll(selector)];
    this.containersIds = containers.map(container => container.id);
  }

  getTemplate(templateId) {
    return this.templates[templateId];
  }

  getViewData(viewDataId) {
    return this.viewData[viewDataId];
  }

  getTemplateByContainerId(containerId) {
    let templateId = document.getElementById(containerId).dataset.templateId;
    return this.getTemplate(templateId);
  }

  getViewDataByContainerId(containerId) {
    let viewDataId = document.getElementById(containerId).dataset.viewDataId;
    return this.getViewData(viewDataId);
  }

  updateViewData(id, data) {
    this.viewData[id] = data;
  }

  generateFullContentOf(containerId) {
    let template = this.getTemplateByContainerId(containerId);
    let viewData = this.getViewDataByContainerId(containerId);
    let html = template(viewData);
    return html;
  }

  generateContentFromTemplate(templateId, data) {
    let template = this.getTemplate(templateId);
    return template(data);
  }

  injectContentIntoContainer(html, containerId, position = "beforeend") {
    let container = document.getElementById(containerId);
    container.insertAdjacentHTML(position, html);
  }

  empty(containerId) {
    let container = document.getElementById(containerId);
    if (!container.children) return;

    [...container.childNodes].forEach(child => child.remove());

  }

  renderFullContentOf(containerId) {
    this.empty(containerId);
    let html = this.generateFullContentOf(containerId);
    this.injectContentIntoContainer(html, containerId);
  }

}