"use strict";

import { ViewModel } from "./view_model.js";

class Model {
  constructor() {
    this.photosData = [];
    this.currentPhotoId = 1;
    this.currentPhotoComments = [];
  }

  getPhotosData() {
    return this._deepCopy(this.photosData);
  }

  getPhotoData(id) {
    return this.getPhotosData().find(photo => photo.id === id);
  }

  getCurrentPhotoComments() {
    return this._deepCopy(this.currentPhotoComments);
  }

  getCurrentPhotoId() {
    return this.currentPhotoId;
  }

  getCurrentPhotoLikes() {
    return this.getPhotoData(this.currentPhotoId).likes;
  }

  getCurrentPhotoPropertyValue(key) {
    return this.getPhotoData(this.currentPhotoId)[key];
  }

  setCurrentPhotoId(id) {
    this.currentPhotoId = +id;
  }

  updatePhotoData(id, key, value) {
    let photoData = this.photosData.find(photo => photo.id === id);
    photoData[key] = value;
  }

  addComment(newComment) {
    this.currentPhotoComments.push(newComment);
  }

  async fetchPhotoData() {
    this.photosData = await (await fetch ('/photos')).json();
  }

  async fetchCommentsById(id) {
    let path = `/comments?photo_id=${id}`;
    this.currentPhotoComments = await (await fetch (path)).json();
  }

  async fetchCurrentPhotoComments() {
    await this.fetchCommentsById(this.getCurrentPhotoId());
  }

  async postClick(property) {
    let data = {photo_id: this.currentPhotoId};
    data[property] = this.getCurrentPhotoPropertyValue(property);
    let config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };

    if (property === 'likes') {
      let likes = (await (await fetch('/photos/like', config)).json()).total;
      this.updatePhotoData(this.currentPhotoId, 'likes', likes);
    } else if (property === 'favorites') {
      let favorites = (await (await fetch('/photos/favorite', config)).json()).total;
      this.updatePhotoData(this.currentPhotoId, 'favorites', favorites);
    }
  }

  async postNewComment(method, path, body) {
    let config = {
      method,
      body,
      headers: {'Content-Type': 'application/json'}
    };

    let newComment = await (await fetch(path, config)).json();
    this.addComment(newComment);
  }

  _deepCopy(object) {
    return JSON.parse(JSON.stringify(object));
  }

}

class ViewModelPhotoGallery extends ViewModel {
  constructor () {
    super();
    this.model = new Model();
  }

  async load() {
    this.registerContainers('.container');
    this.initializeTemplates();

    await Promise.all([
      this.model.fetchPhotoData(),
      this.model.fetchCurrentPhotoComments()
    ]);

    this.syncWithModel();
    this.renderAll();
  }

  bindEventHandlers() {
    let slideshowContainer = document.querySelector('#slideshow');
    let photoInfoContainer = document.querySelector('#photo_info');
    let form = document.querySelector('form');

    slideshowContainer.addEventListener('click', event => this.handleSlideShow(event));
    photoInfoContainer.addEventListener('click', event => this.handleLikesAndFavs(event));
    form.addEventListener('submit', event => this.handleNewComment(event));
  }

  syncWithModel() {
    this.syncWithModelPhotos();
    this.syncWithModelPhotoInfo();
    this.syncWithModelComments();
    this.syncWithModelCommentForm();
  }

  syncWithModelPhotos() {
    this.updateViewData('photos', this.processPhotosData());
  }

  syncWithModelPhotoInfo() {
    let id = this.model.getCurrentPhotoId();
    this.updateViewData('photo_information', this.processPhotoInfoData(id));
  }

  syncWithModelComments() {
    this.updateViewData('photo_comments', this.processCurrentCommentsData());
  }

  updateFormCurrentPhotoId() {
    this.syncWithModelCommentForm();
    document.querySelector('form>fieldset>input').value = this.getViewData('formCurrentPhotoId');
  }

  syncWithModelCommentForm() {
    this.updateViewData('formCurrentPhotoId', this.model.getCurrentPhotoId());
  }

  processPhotosData() {
    let dataRaw = this.model.getPhotosData();
    let dataProcessed = dataRaw.reduce((data, photo) => {
      data.push(this._copyProperties(photo, 'id', 'src', 'caption'));
      return data;
    }, []);

    return {photos: dataProcessed};
  }

  processPhotoInfoData(id) {
    let dataRaw = this.model.getPhotoData(id);
    return this._copyProperties(dataRaw, 'title', 'likes', 'favorites');
  }

  processCurrentCommentsData() {
    let dataRaw = this.model.getCurrentPhotoComments();
    let dataProcessed = dataRaw.reduce((data, comment) => {
      data.push(this._copyProperties(comment, 'gravatar', 'name', 'date', 'body'));
      return data;
    }, []);

    return {comments: dataProcessed};
  }

  _copyProperties(original, ...properties) {
    let copy = {};
    properties.forEach(property => {
      copy[property] = original[property];
    });

    return copy;
  }

  renderAll() {
    this.containersIds.forEach(id => this.renderFullContentOf(id));
  }

  renderPhotoInfo() {
    this.syncWithModelPhotoInfo();
    this.renderFullContentOf('photo_info');
  }

  async renderComments() {
    await this.model.fetchCurrentPhotoComments();
    this.syncWithModelComments();
    this.renderFullContentOf('comments_list');
  }

  updateButtonText(property) {
    let viewDataId = document.querySelector('#photo_info').dataset.viewDataId;
    let count = this.viewData[viewDataId][property];
    let button = document.querySelector(`[data-property="${property}"]`);
    button.textContent = button.textContent.replace(/\d+/,count);
  }

  handleSlideShow(event) {
    event.preventDefault();
    let arrow = event.target;
    if (arrow.classList.contains('next')) {
      this.nextPhoto();
    } else if (arrow.classList.contains('prev')) {
      this.previousPhoto();
    }

    if (arrow.classList.contains('next') || arrow.classList.contains('prev')) {
      let currentPhotoId =
        document.querySelector('#slideshow .show').dataset.id;
      this.model.setCurrentPhotoId(currentPhotoId);
      this.updateFormCurrentPhotoId();

      this.renderPhotoInfo();
      this.renderComments();
    }
  }

  async handleLikesAndFavs(event) {
    event.preventDefault();

    if (event.target.dataset.hasOwnProperty('property')) {
      let property = event.target.dataset.property;
      await this.model.postClick(property);
      this.syncWithModelPhotoInfo();
      this.updateButtonText(property);
    }
  }

  async handleNewComment(event) {
    event.preventDefault();
    let form = event.target;
    let path = form.action;
    let method = form.method;
    let json = this.serializeToJson(form);
    await this.model.postNewComment(method, path, json);

    this.syncWithModelComments();
    this.renderLastComment();
    form.reset();
  }

  renderLastComment() {
    let containerId = 'comments_list';
    let templateId = "photo_comment";

    let comments = this.getViewDataByContainerId(containerId).comments;
    let lastComment = comments[comments.length - 1];

    let lastCommentHTML = this.generateContentFromTemplate(templateId,lastComment);
    this.injectContentIntoContainer(lastCommentHTML, containerId);
  }

  nextPhoto() {
    let photosContainer = document.querySelector('#slides');
    let currentPhoto =
      photosContainer.querySelector('.show') ||
      photosContainer.firstElementChild;

    let nextPhoto =
      currentPhoto.nextElementSibling ||
      photosContainer.firstElementChild;

    currentPhoto.classList.remove('show');
    currentPhoto.classList.add('hidden');
    nextPhoto.classList.remove('hidden');
    nextPhoto.classList.add('show');
  }

  previousPhoto() {
    let photosContainer = document.querySelector('#slides');
    let currentPhoto =
      photosContainer.querySelector('.show') ||
      photosContainer.lastElementChild;

    let previousPhoto =
      currentPhoto.previousElementSibling ||
      photosContainer.lastElementChild;

    currentPhoto.classList.remove('show');
    currentPhoto.classList.add('hidden');
    previousPhoto.classList.remove('hidden');
    previousPhoto.classList.add('show');
  }

  serializeToJson(form) {
    let entries = [...new FormData(form)];
    return JSON.stringify(Object.fromEntries(entries));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  let gallery = new ViewModelPhotoGallery();
  gallery.load();
  gallery.bindEventHandlers();
  console.log(gallery);
});

