import { NgModule, InjectionToken } from '@angular/core';
import { Routes, RouterModule, ActivatedRouteSnapshot } from '@angular/router';
import { EmptyComponent } from './components/empty/empty.component';


const routes: Routes = [
	{
		path: '',
		component: EmptyComponent,
		pathMatch: 'full'
	},
	{
		path: 'page/:pageNumber',
		component: EmptyComponent,
	},
	{
		path: 'externalRedirect',
		component: EmptyComponent,
	},
	{
		path: ':slug',
		component: EmptyComponent
	},
	{
		path: ':slug/comments-page/:commentsPageNumber',
		component: EmptyComponent,
	},
	{
		path: ':slug/page/:pageNumber',
		component: EmptyComponent
	},
	{
		path: ':type/:typeSlug',
		component: EmptyComponent
	},
	{
		path: ':type/:typeSlug/page/:pageNumber',
		component: EmptyComponent
	},
];



@NgModule({
	imports: [RouterModule.forRoot(routes)], // {onSameUrlNavigation: 'reload'}
	exports: [RouterModule],
	providers: []
})
export class NgWpRoutingModule { }
