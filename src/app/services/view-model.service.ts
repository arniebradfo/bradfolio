import { Injectable } from '@angular/core';
import { IWpPost, IWpPage, IWpComment, IWpError, WpSort, WpFilterItem } from 'app/interfaces/wp-rest-types';
import { WpRestService } from './wp-rest.service';
import { Router, ActivationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { StateRoot } from '../components/root/root.component';

@Injectable()
export class ViewModelService {

	private _slug?: string;
	private _typeSlug?: string;
	private _type?: WpSort;
	private _state: StateRoot; // = 'state-list';
	private _pageNumber: number = 1;
	private _commentsPageNumber: number = 1;

	private _routerInfo: IRouterInfo[] = [];
	routerInfo$: Subject<IRouterInfo[]> = new Subject();

	private _currentPost: IWpPost | IWpPage;
	post$: Subject<{
		currentPost: (IWpPost | IWpPage);
	}> = new Subject();

	private _currentList: (IWpPost | IWpPage)[];
	private _wholeList: (IWpPost | IWpPage)[];
	private _postsPerPage: number;
	private _currentListPageCount: number;
	private _canLoadMorePages: boolean;
	private _loadMorePageCount: number = 1;
	private _filterItem: WpFilterItem;
	postList$: Subject<{
		currentList: (IWpPost | IWpPage)[];
		postsPerPage: number;
		currentListPageNumber: number;
		currentListPageCount: number;
		currentListPostCount: number;
		currentListRouterPrefix: string;
		canLoadMorePages: boolean;
		loadMorePageCount: number;
		typeSlug: string;
		type?: WpSort;
		filterItem: WpFilterItem;
	}> = new Subject();

	private _allComments: IWpComment[];
	private _commentsPerPage: number;
	private _commentsPageCount: number;
	private _comments: IWpComment[];
	commentList$: Subject<{
		currentPost: (IWpPost | IWpPage);
		allComments: IWpComment[];
		commentsPerPage: number;
		commentsPageNumber: number;
		commentsPageCount: number;
		comments: IWpComment[];
	}> = new Subject();

	constructor(
		private _wpRestService: WpRestService,
		private _router: Router,
		private _titleService: Title
	) {
		// console.log(this);
		this._router.events.subscribe(event => {
			if (event instanceof ActivationEnd)
				this._updateView(event)
		})
	}

	private _emitRouterInfo() {
		this._routerInfo.unshift({
			slug: this._slug,
			typeSlug: this._typeSlug,
			type: this._type,
			state: this._state,
			pageNumber: this._pageNumber,
			commentsPageNumber: this._commentsPageNumber,
			changes: this._routerInfo[0] ? {
				// TODO: postList vs postListHeader
				postList:
					this._type !== this._routerInfo[0].type ||
					this._typeSlug !== this._routerInfo[0].typeSlug ||
					this._pageNumber !== this._routerInfo[0].pageNumber ||
					this._loadMorePageCount > 1,
				postListPageNumber: this._pageNumber !== this._routerInfo[0].pageNumber,
				post: this._slug !== this._routerInfo[0].slug,
				postCommentPageNumber: this._commentsPageNumber !== this._routerInfo[0].commentsPageNumber
			} : { postList: true, postListPageNumber: true, post: true, postCommentPageNumber: true }
		});
		this.routerInfo$.next(this._routerInfo)
	}

	private _emitPost() {
		this.post$.next({
			currentPost: this._currentPost,
		});
	}

	private _emitPostList() {
		this.postList$.next({
			currentList: this._currentList,
			postsPerPage: this._postsPerPage,
			currentListPageNumber: this._pageNumber,
			currentListPageCount: this._currentListPageCount,
			currentListPostCount: this._wholeList.length,
			currentListRouterPrefix: this._type && this._typeSlug ? `/${this._type}/${this._typeSlug}` : '',
			canLoadMorePages: this._canLoadMorePages,
			loadMorePageCount: this._loadMorePageCount,
			typeSlug: this._typeSlug || 'Posts',
			type: this._type,
			filterItem: this._filterItem
		});
	}

	private _emitComments() {
		this.commentList$.next({
			currentPost: this._currentPost,
			allComments: this._allComments,
			commentsPerPage: this._commentsPerPage,
			commentsPageNumber: this._commentsPageNumber,
			commentsPageCount: this._commentsPageCount,
			comments: this._comments,
		});
	}

	private _updateView(event: ActivationEnd) {
		// console.log(event); // for debug

		if (event.snapshot.routeConfig.path === 'externalRedirect') {
			// TODO: animate out first or go open in another window
			window.open(event.snapshot.params.externalUrl, '_self');
			return;
		}

		const params = event.snapshot.params;
		const queryParams = event.snapshot.queryParams;
		const type = params.type;
		const typeSlug = params.typeSlug;
		const slug = params.slug;
		const isHome = !type && !typeSlug && !slug;
		const menuOpen = queryParams.m != null && queryParams.m !== 'false';

		this._state = !menuOpen ? slug != null ? 'state-post' : 'state-post-list' : 'state-menu';

		if (type)
			this._type = type;
		if (typeSlug)
			this._typeSlug = typeSlug;
		if (type || typeSlug || isHome)
			this._pageNumber = +params.pageNumber || 1;
		if (isHome)
			this._typeSlug = this._type = undefined; // this._slug too?
		if (slug) {
			this._slug = slug;
			this._commentsPageNumber = +params.commentsPageNumber || 1;
			// TODO: maybe _commentsPageNumber setter doesn't go here...
		}

		this._updateTitle();
		this._emitRouterInfo();

		if (this._routerInfo[0].changes.post)
			this.updatePost();
		if (this._routerInfo[0].changes.postList)
			this.updatePostList(type, typeSlug);
	}

	private _updateTitle() {
		this._wpRestService.options
			.then(options => {
				// TODO: fix this
				const subtitle = this._typeSlug || this._slug || options.general.blogdescription; // should be slug reneder name
				this._titleService.setTitle(`${options.general.blogname} // ${subtitle}`);
			});
	}

	updatePost() {
		this._wpRestService.getPostOrPage(this._slug)
			.then(post => {
				if (!post) return;
				this._currentPost = post;
				this._emitPost();

				if (!this._currentPost.isLocked)
					this.updateComments();
			});
	}

	getPasswordProtected(id: number, password: string) {
		this._wpRestService.getPasswordProtected(id, password)
			.then(post => {
				if (!post) return;
				this._currentPost = post;
				this.updateComments(password);
				this._emitPost();
			}, (err: IWpError) => {
				this._emitPost();
			});
	}

	updateComments(password?: string) {
		// const password = undefined; // figure this out later

		// get the comments for the current post from the WpRestService
		Promise.all([
			this._wpRestService.getComments(this._currentPost, password),
			this._wpRestService.options
		]).then(res => {
			const comments = this._allComments = res[0];
			const options = res[1];

			// get the number of comment-pages
			this._commentsPerPage = options.discussion.comments_per_page;
			this._commentsPageCount = Math.ceil(comments.length / this._commentsPerPage);

			// get the current comment-page's set of comments
			const lowerIndex = this._commentsPerPage * (this._commentsPageNumber - 1);
			const upperIndex = this._commentsPerPage * this._commentsPageNumber;

			this._comments = comments.slice(lowerIndex, upperIndex);
			this._emitComments();
		});
	}

	updatePostList(type?: WpSort, slug?: string) {
		// retrieve the requested set of posts from the WpRestService
		Promise.all([
			this._wpRestService.getPosts(type, slug),
			this._wpRestService.options,
			this._wpRestService.getListFilter(type, slug),
		]).then(res => {
			this._wholeList = res[0];
			const options = res[1];
			this._filterItem = res[2];

			this._loadMorePageCount = 1;

			// get the number of post-list pages
			this._postsPerPage = options.reading.posts_per_page;
			this._currentListPageCount = Math.ceil(this._wholeList.length / this._postsPerPage);

			// get the current page's set of posts
			const lowerIndex = this._postsPerPage * (this._pageNumber - 1);
			const upperIndex = this._postsPerPage * this._pageNumber;
			this._canLoadMorePages = this._wholeList.length > upperIndex
			this._currentList = this._wholeList.slice(lowerIndex, upperIndex);

			this._emitPostList();
		});
	}

	loadMorePosts() {
		this._loadMorePageCount++;
		const lowerIndex = this._postsPerPage * (this._pageNumber - 1);
		const upperIndex = this._postsPerPage * (this._pageNumber + this._loadMorePageCount - 1);
		this._canLoadMorePages = this._wholeList.length > upperIndex
		this._currentList = this._wholeList.slice(lowerIndex, upperIndex);

		this._emitPostList();
	}

}


export interface IRouterInfo {
	slug?: string;
	typeSlug?: string;
	type?: WpSort;
	state: StateRoot;
	pageNumber: number;
	commentsPageNumber: number;
	changes: {
		postList: boolean;
		postListPageNumber: boolean;
		post: boolean;
		postCommentPageNumber: boolean;
	};
};
