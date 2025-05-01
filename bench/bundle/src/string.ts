import { asyncHtmlToMarkdown } from '../../../dist/index'

const html = `
<!DOCTYPE html>
<html class="client-nojs vector-feature-language-in-header-enabled vector-feature-language-in-main-page-header-disabled vector-feature-page-tools-pinned-disabled vector-feature-toc-pinned-clientpref-1 vector-feature-main-menu-pinned-disabled vector-feature-limited-width-clientpref-1 vector-feature-limited-width-content-enabled vector-feature-custom-font-size-clientpref-1 vector-feature-appearance-pinned-clientpref-1 vector-feature-night-mode-enabled skin-theme-clientpref-day vector-sticky-header-enabled vector-toc-available" lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<title>Markdown - Wikipedia</title>
<script>(function(){var className="client-js vector-feature-language-in-header-enabled vector-feature-language-in-main-page-header-disabled vector-feature-page-tools-pinned-disabled vector-feature-toc-pinned-clientpref-1 vector-feature-main-menu-pinned-disabled vector-feature-limited-width-clientpref-1 vector-feature-limited-width-content-enabled vector-feature-custom-font-size-clientpref-1 vector-feature-appearance-pinned-clientpref-1 vector-feature-night-mode-enabled skin-theme-clientpref-day vector-sticky-header-enabled vector-toc-available";var cookie=document.cookie.match(/(?:^|; )enwikimwclientpreferences=([^;]+)/);if(cookie){cookie[1].split('%2C').forEach(function(pref){className=className.replace(new RegExp('(^| )'+pref.replace(/-clientpref-\\w+$|[^\\w-]+/g,'')+'-clientpref-\\\\w+( |$)'),'$1'+pref+'$2');});}document.documentElement.className=className;}());RLCONF={"wgBreakFrames":false,"wgSeparatorTransformTable":["",""],"wgDigitTransformTable":["",""],"wgDefaultDateFormat":"dmy","wgMonthNames":["","January","February","March","April","May","June","July","August","September","October","November","December"],"wgRequestId":"25259504-dbc1-4bc2-8a4c-31e661216526","wgCanonicalNamespace":"","wgCanonicalSpecialPageName":false,"wgNamespaceNumber":0,"wgPageName":"Markdown","wgTitle":"Markdown","wgCurRevisionId":1285991210,"wgRevisionId":1285991210,"wgArticleId":2415885,"wgIsArticle":true,"wgIsRedirect":false,"wgAction":"view","wgUserName":null,"wgUserGroups":["*"],"wgCategories":["Articles with short description","Short description is different from Wikidata","Computer-related introductions in 2004","Lightweight markup languages","Open formats"],"wgPageViewLanguage":"en","wgPageContentLanguage":"en","wgPageContentModel":"wikitext","wgRelevantPageName":"Markdown","wgRelevantArticleId":2415885,"wgIsProbablyEditable":true,"wgRelevantPageIsProbablyEditable":true,"wgRestrictionEdit":[],"wgRestrictionMove":[],"wgNoticeProject":"wikipedia","wgCiteReferencePreviewsActive":false,"wgFlaggedRevsParams":{"tags":{"status":{"levels":1}}},"wgMediaViewerOnClick":true,"wgMediaViewerEnabledByDefault":true,"wgPopupsFlags":0,"wgVisualEditor":{"pageLanguageCode":"en","pageLanguageDir":"ltr","pageVariantFallbacks":"en"},"wgMFDisplayWikibaseDescriptions":{"search":true,"watchlist":true,"tagline":false,"nearby":true},"wgWMESchemaEditAttemptStepOversample":false,"wgWMEPageLength":30000,"wgEditSubmitButtonLabelPublish":true,"wgULSPosition":"interlanguage","wgULSisCompactLinksEnabled":false,"wgVector2022LanguageInHeader":true,"wgULSisLanguageSelectorEmpty":false,"wgWikibaseItemId":"Q1193600","wgCheckUserClientHintsHeadersJsApi":["brands","architecture","bitness","fullVersionList","mobile","model","platform","platformVersion"],"GEHomepageSuggestedEditsEnableTopics":true,"wgGETopicsMatchModeEnabled":false,"wgGELevelingUpEnabledForUser":false};
RLSTATE={"ext.globalCssJs.user.styles":"ready","site.styles":"ready","user.styles":"ready","ext.globalCssJs.user":"ready","user":"ready","user.options":"loading","ext.cite.styles":"ready","ext.pygments":"ready","skins.vector.search.codex.styles":"ready","skins.vector.styles":"ready","skins.vector.icons":"ready","jquery.makeCollapsible.styles":"ready","ext.wikimediamessages.styles":"ready","ext.visualEditor.desktopArticleTarget.noscript":"ready","ext.uls.interlanguage":"ready","wikibase.client.init":"ready"};RLPAGEMODULES=["ext.cite.ux-enhancements","ext.pygments.view","site","mediawiki.page.ready","jquery.makeCollapsible","mediawiki.toc","skins.vector.js","ext.centralNotice.geoIP","ext.centralNotice.startUp","ext.gadget.ReferenceTooltips","ext.gadget.switcher","ext.urlShortener.toolbar","ext.centralauth.centralautologin","mmv.bootstrap","ext.popups","ext.visualEditor.desktopArticleTarget.init","ext.visualEditor.targetLoader","ext.echo.centralauth","ext.eventLogging","ext.wikimediaEvents","ext.navigationTiming","ext.uls.interface","ext.cx.eventlogging.campaigns","ext.cx.uls.quick.actions","wikibase.client.vector-2022","ext.checkUser.clientHints","ext.quicksurveys.init","ext.growthExperiments.SuggestedEditSession"];</script>
<script>(RLQ=window.RLQ||[]).push(function(){mw.loader.impl(function(){return["user.options@12s5i",function($,jQuery,require,module){mw.user.tokens.set({"patrolToken":"+\\\\","watchToken":"+\\\\","csrfToken":"+\\\\"});
}];});});</script>
<link rel="stylesheet" href="/w/load.php?lang=en&amp;modules=ext.cite.styles%7Cext.pygments%7Cext.uls.interlanguage%7Cext.visualEditor.desktopArticleTarget.noscript%7Cext.wikimediamessages.styles%7Cjquery.makeCollapsible.styles%7Cskins.vector.icons%2Cstyles%7Cskins.vector.search.codex.styles%7Cwikibase.client.init&amp;only=styles&amp;skin=vector-2022">
<script async="" src="/w/load.php?lang=en&amp;modules=startup&amp;only=scripts&amp;raw=1&amp;skin=vector-2022"></script>
<meta name="ResourceLoaderDynamicStyles" content="">
<link rel="stylesheet" href="/w/load.php?lang=en&amp;modules=site.styles&amp;only=styles&amp;skin=vector-2022">
<meta name="generator" content="MediaWiki 1.44.0-wmf.25">
<meta name="referrer" content="origin">
<meta name="referrer" content="origin-when-cross-origin">
<meta name="robots" content="max-image-preview:standard">
<meta name="format-detection" content="telephone=no">
<meta property="og:image" content="https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/1200px-Markdown-mark.svg.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="738">
<meta property="og:image" content="https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/800px-Markdown-mark.svg.png">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="492">
<meta property="og:image" content="https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/640px-Markdown-mark.svg.png">
<meta property="og:image:width" content="640">
<meta property="og:image:height" content="394">
<meta name="viewport" content="width=1120">
<meta property="og:title" content="Markdown - Wikipedia">
<meta property="og:type" content="website">
<link rel="preconnect" href="//upload.wikimedia.org">
<link rel="alternate" media="only screen and (max-width: 640px)" href="//en.m.wikipedia.org/wiki/Markdown">
<link rel="alternate" type="application/x-wiki" title="Edit this page" href="/w/index.php?title=Markdown&amp;action=edit">
<link rel="apple-touch-icon" href="/static/apple-touch/wikipedia.png">
<link rel="icon" href="/static/favicon/wikipedia.ico">
<link rel="search" type="application/opensearchdescription+xml" href="/w/rest.php/v1/search" title="Wikipedia (en)">
<link rel="EditURI" type="application/rsd+xml" href="//en.wikipedia.org/w/api.php?action=rsd">
<link rel="canonical" href="https://en.wikipedia.org/wiki/Markdown">
<link rel="license" href="https://creativecommons.org/licenses/by-sa/4.0/deed.en">
<link rel="alternate" type="application/atom+xml" title="Wikipedia Atom feed" href="/w/index.php?title=Special:RecentChanges&amp;feed=atom">
<link rel="dns-prefetch" href="//meta.wikimedia.org" />
<link rel="dns-prefetch" href="auth.wikimedia.org">
</head>
<body class="skin--responsive skin-vector skin-vector-search-vue mediawiki ltr sitedir-ltr mw-hide-empty-elt ns-0 ns-subject mw-editable page-Markdown rootpage-Markdown skin-vector-2022 action-view"><a class="mw-jump-link" href="#bodyContent">Jump to content</a>
<div class="vector-header-container">
\t<header class="vector-header mw-header">
\t\t<div class="vector-header-start">
\t\t\t<nav class="vector-main-menu-landmark" aria-label="Site">
\t\t\t\t
<div id="vector-main-menu-dropdown" class="vector-dropdown vector-main-menu-dropdown vector-button-flush-left vector-button-flush-right"  title="Main menu" >
\t<input type="checkbox" id="vector-main-menu-dropdown-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-main-menu-dropdown" class="vector-dropdown-checkbox "  aria-label="Main menu"  >
\t<label id="vector-main-menu-dropdown-label" for="vector-main-menu-dropdown-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only " aria-hidden="true"  ><span class="vector-icon mw-ui-icon-menu mw-ui-icon-wikimedia-menu"></span>

<span class="vector-dropdown-label-text">Main menu</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t\t<div id="vector-main-menu-unpinned-container" class="vector-unpinned-container">
\t\t
<div id="vector-main-menu" class="vector-main-menu vector-pinnable-element">
\t<div
\tclass="vector-pinnable-header vector-main-menu-pinnable-header vector-pinnable-header-unpinned"
\tdata-feature-name="main-menu-pinned"
\tdata-pinnable-element-id="vector-main-menu"
\tdata-pinned-container-id="vector-main-menu-pinned-container"
\tdata-unpinned-container-id="vector-main-menu-unpinned-container"
>
\t<div class="vector-pinnable-header-label">Main menu</div>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button" data-event-name="pinnable-header.vector-main-menu.pin">move to sidebar</button>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button" data-event-name="pinnable-header.vector-main-menu.unpin">hide</button>
</div>

\t
<div id="p-navigation" class="vector-menu mw-portlet mw-portlet-navigation"  >
\t<div class="vector-menu-heading">
\t\tNavigation
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="n-mainpage-description" class="mw-list-item"><a href="/wiki/Main_Page" title="Visit the main page [z]" accesskey="z"><span>Main page</span></a></li><li id="n-contents" class="mw-list-item"><a href="/wiki/Wikipedia:Contents" title="Guides to browsing Wikipedia"><span>Contents</span></a></li><li id="n-currentevents" class="mw-list-item"><a href="/wiki/Portal:Current_events" title="Articles related to current events"><span>Current events</span></a></li><li id="n-randompage" class="mw-list-item"><a href="/wiki/Special:Random" title="Visit a randomly selected article [x]" accesskey="x"><span>Random article</span></a></li><li id="n-aboutsite" class="mw-list-item"><a href="/wiki/Wikipedia:About" title="Learn about Wikipedia and how it works"><span>About Wikipedia</span></a></li><li id="n-contactpage" class="mw-list-item"><a href="//en.wikipedia.org/wiki/Wikipedia:Contact_us" title="How to contact Wikipedia"><span>Contact us</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

\t
\t
<div id="p-interaction" class="vector-menu mw-portlet mw-portlet-interaction"  >
\t<div class="vector-menu-heading">
\t\tContribute
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="n-help" class="mw-list-item"><a href="/wiki/Help:Contents" title="Guidance on how to use and edit Wikipedia"><span>Help</span></a></li><li id="n-introduction" class="mw-list-item"><a href="/wiki/Help:Introduction" title="Learn how to edit Wikipedia"><span>Learn to edit</span></a></li><li id="n-portal" class="mw-list-item"><a href="/wiki/Wikipedia:Community_portal" title="The hub for editors"><span>Community portal</span></a></li><li id="n-recentchanges" class="mw-list-item"><a href="/wiki/Special:RecentChanges" title="A list of recent changes to Wikipedia [r]" accesskey="r"><span>Recent changes</span></a></li><li id="n-upload" class="mw-list-item"><a href="/wiki/Wikipedia:File_upload_wizard" title="Add images or other media for use on Wikipedia"><span>Upload file</span></a></li><li id="n-specialpages" class="mw-list-item"><a href="/wiki/Special:SpecialPages"><span>Special pages</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

</div>

\t\t\t\t</div>

\t</div>
</div>

\t\t</nav>
\t\t\t
<a href="/wiki/Main_Page" class="mw-logo">
\t<img class="mw-logo-icon" src="/static/images/icons/wikipedia.png" alt="" aria-hidden="true" height="50" width="50">
\t<span class="mw-logo-container skin-invert">
\t\t<img class="mw-logo-wordmark" alt="Wikipedia" src="/static/images/mobile/copyright/wikipedia-wordmark-en.svg" style="width: 7.5em; height: 1.125em;">
\t\t<img class="mw-logo-tagline" alt="The Free Encyclopedia" src="/static/images/mobile/copyright/wikipedia-tagline-en.svg" width="117" height="13" style="width: 7.3125em; height: 0.8125em;">
\t</span>
</a>

\t\t</div>
\t\t<div class="vector-header-end">
\t\t\t
<div id="p-search" role="search" class="vector-search-box-vue  vector-search-box-collapses vector-search-box-show-thumbnail vector-search-box-auto-expand-width vector-search-box">
\t<a href="/wiki/Special:Search" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only search-toggle" title="Search Wikipedia [f]" accesskey="f"><span class="vector-icon mw-ui-icon-search mw-ui-icon-wikimedia-search"></span>

<span>Search</span>
\t</a>
\t<div class="vector-typeahead-search-container">
\t\t<div class="cdx-typeahead-search cdx-typeahead-search--show-thumbnail cdx-typeahead-search--auto-expand-width">
\t\t\t<form action="/w/index.php" id="searchform" class="cdx-search-input cdx-search-input--has-end-button">
\t\t\t\t<div id="simpleSearch" class="cdx-search-input__input-wrapper"  data-search-loc="header-moved">
\t\t\t\t\t<div class="cdx-text-input cdx-text-input--has-start-icon">
\t\t\t\t\t\t<input
\t\t\t\t\t\t\tclass="cdx-text-input__input"
\t\t\t\t\t\t\t type="search" name="search" placeholder="Search Wikipedia" aria-label="Search Wikipedia" autocapitalize="sentences" title="Search Wikipedia [f]" accesskey="f" id="searchInput"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t<span class="cdx-text-input__icon cdx-text-input__start-icon"></span>
\t\t\t\t\t</div>
\t\t\t\t\t<input type="hidden" name="title" value="Special:Search">
\t\t\t\t</div>
\t\t\t\t<button class="cdx-button cdx-search-input__end-button">Search</button>
\t\t\t</form>
\t\t</div>
\t</div>
</div>

\t\t\t<nav class="vector-user-links vector-user-links-wide" aria-label="Personal tools">
\t<div class="vector-user-links-main">
\t
<div id="p-vector-user-menu-preferences" class="vector-menu mw-portlet emptyPortlet"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t
\t\t</ul>
\t\t
\t</div>
</div>

\t
<div id="p-vector-user-menu-userpage" class="vector-menu mw-portlet emptyPortlet"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t
\t\t</ul>
\t\t
\t</div>
</div>

\t<nav class="vector-appearance-landmark" aria-label="Appearance">
\t\t
<div id="vector-appearance-dropdown" class="vector-dropdown "  title="Change the appearance of the page&#039;s font size, width, and color" >
\t<input type="checkbox" id="vector-appearance-dropdown-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-appearance-dropdown" class="vector-dropdown-checkbox "  aria-label="Appearance"  >
\t<label id="vector-appearance-dropdown-label" for="vector-appearance-dropdown-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only " aria-hidden="true"  ><span class="vector-icon mw-ui-icon-appearance mw-ui-icon-wikimedia-appearance"></span>

<span class="vector-dropdown-label-text">Appearance</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t<div id="vector-appearance-unpinned-container" class="vector-unpinned-container">
\t\t\t\t
\t\t\t</div>
\t\t
\t</div>
</div>

\t</nav>
\t
<div id="p-vector-user-menu-notifications" class="vector-menu mw-portlet emptyPortlet"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t
\t\t</ul>
\t\t
\t</div>
</div>

\t
<div id="p-vector-user-menu-overflow" class="vector-menu mw-portlet"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t<li id="pt-sitesupport-2" class="user-links-collapsible-item mw-list-item user-links-collapsible-item"><a data-mw="interface" href="https://donate.wikimedia.org/?wmf_source=donate&amp;wmf_medium=sidebar&amp;wmf_campaign=en.wikipedia.org&amp;uselang=en" class=""><span>Donate</span></a>
</li>
<li id="pt-createaccount-2" class="user-links-collapsible-item mw-list-item user-links-collapsible-item"><a data-mw="interface" href="/w/index.php?title=Special:CreateAccount&amp;returnto=Markdown" title="You are encouraged to create an account and log in; however, it is not mandatory" class=""><span>Create account</span></a>
</li>
<li id="pt-login-2" class="user-links-collapsible-item mw-list-item user-links-collapsible-item"><a data-mw="interface" href="/w/index.php?title=Special:UserLogin&amp;returnto=Markdown" title="You&#039;re encouraged to log in; however, it&#039;s not mandatory. [o]" accesskey="o" class=""><span>Log in</span></a>
</li>

\t\t\t
\t\t</ul>
\t\t
\t</div>
</div>

\t</div>
\t
<div id="vector-user-links-dropdown" class="vector-dropdown vector-user-menu vector-button-flush-right vector-user-menu-logged-out"  title="Log in and more options" >
\t<input type="checkbox" id="vector-user-links-dropdown-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-user-links-dropdown" class="vector-dropdown-checkbox "  aria-label="Personal tools"  >
\t<label id="vector-user-links-dropdown-label" for="vector-user-links-dropdown-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only " aria-hidden="true"  ><span class="vector-icon mw-ui-icon-ellipsis mw-ui-icon-wikimedia-ellipsis"></span>

<span class="vector-dropdown-label-text">Personal tools</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t
<div id="p-personal" class="vector-menu mw-portlet mw-portlet-personal user-links-collapsible-item"  title="User menu" >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="pt-sitesupport" class="user-links-collapsible-item mw-list-item"><a href="https://donate.wikimedia.org/?wmf_source=donate&amp;wmf_medium=sidebar&amp;wmf_campaign=en.wikipedia.org&amp;uselang=en"><span>Donate</span></a></li><li id="pt-createaccount" class="user-links-collapsible-item mw-list-item"><a href="/w/index.php?title=Special:CreateAccount&amp;returnto=Markdown" title="You are encouraged to create an account and log in; however, it is not mandatory"><span class="vector-icon mw-ui-icon-userAdd mw-ui-icon-wikimedia-userAdd"></span> <span>Create account</span></a></li><li id="pt-login" class="user-links-collapsible-item mw-list-item"><a href="/w/index.php?title=Special:UserLogin&amp;returnto=Markdown" title="You&#039;re encouraged to log in; however, it&#039;s not mandatory. [o]" accesskey="o"><span class="vector-icon mw-ui-icon-logIn mw-ui-icon-wikimedia-logIn"></span> <span>Log in</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

<div id="p-user-menu-anon-editor" class="vector-menu mw-portlet mw-portlet-user-menu-anon-editor"  >
\t<div class="vector-menu-heading">
\t\tPages for logged out editors <a href="/wiki/Help:Introduction" aria-label="Learn more about editing"><span>learn more</span></a>
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="pt-anoncontribs" class="mw-list-item"><a href="/wiki/Special:MyContributions" title="A list of edits made from this IP address [y]" accesskey="y"><span>Contributions</span></a></li><li id="pt-anontalk" class="mw-list-item"><a href="/wiki/Special:MyTalk" title="Discussion about edits from this IP address [n]" accesskey="n"><span>Talk</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

\t
\t</div>
</div>

</nav>

\t\t</div>
\t</header>
</div>
<div class="mw-page-container">
\t<div class="mw-page-container-inner">
\t\t<div class="vector-sitenotice-container">
\t\t\t<div id="siteNotice"><!-- CentralNotice --></div>
\t\t</div>
\t\t<div class="vector-column-start">
\t\t\t<div class="vector-main-menu-container">
\t\t<div id="mw-navigation">
\t\t\t<nav id="mw-panel" class="vector-main-menu-landmark" aria-label="Site">
\t\t\t\t<div id="vector-main-menu-pinned-container" class="vector-pinned-container">
\t\t\t\t
\t\t\t\t</div>
\t\t</nav>
\t\t</div>
\t</div>
\t<div class="vector-sticky-pinned-container">
\t\t\t\t<nav id="mw-panel-toc" aria-label="Contents" data-event-name="ui.sidebar-toc" class="mw-table-of-contents-container vector-toc-landmark">
\t\t\t\t\t<div id="vector-toc-pinned-container" class="vector-pinned-container">
\t\t\t\t\t<div id="vector-toc" class="vector-toc vector-pinnable-element">
\t<div
\tclass="vector-pinnable-header vector-toc-pinnable-header vector-pinnable-header-pinned"
\tdata-feature-name="toc-pinned"
\tdata-pinnable-element-id="vector-toc"
\t
\t
>
\t<h2 class="vector-pinnable-header-label">Contents</h2>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button" data-event-name="pinnable-header.vector-toc.pin">move to sidebar</button>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button" data-event-name="pinnable-header.vector-toc.unpin">hide</button>
</div>


\t<ul class="vector-toc-contents" id="mw-panel-toc-list">
\t\t<li id="toc-mw-content-text"
\t\t\tclass="vector-toc-list-item vector-toc-level-1">
\t\t\t<a href="#" class="vector-toc-link">
\t\t\t\t<div class="vector-toc-text">(Top)</div>
\t\t\t</a>
\t\t</li>
\t\t<li id="toc-History"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#History">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">1</span>
\t\t\t\t<span>History</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-History-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-Rise_and_divergence"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Rise_and_divergence">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">2</span>
\t\t\t\t<span>Rise and divergence</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-Rise_and_divergence-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-Standardization"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Standardization">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">3</span>
\t\t\t\t<span>Standardization</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-Standardization-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-Variants"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Variants">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">4</span>
\t\t\t\t<span>Variants</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t\t<button aria-controls="toc-Variants-sublist" class="cdx-button cdx-button--weight-quiet cdx-button--icon-only vector-toc-toggle">
\t\t\t\t<span class="vector-icon mw-ui-icon-wikimedia-expand"></span>
\t\t\t\t<span>Toggle Variants subsection</span>
\t\t\t</button>
\t\t
\t\t<ul id="toc-Variants-sublist" class="vector-toc-list">
\t\t\t<li id="toc-GitHub_Flavored_Markdown"
\t\t\tclass="vector-toc-list-item vector-toc-level-2">
\t\t\t<a class="vector-toc-link" href="#GitHub_Flavored_Markdown">
\t\t\t\t<div class="vector-toc-text">
\t\t\t\t\t<span class="vector-toc-numb">4.1</span>
\t\t\t\t\t<span>GitHub Flavored Markdown</span>
\t\t\t\t</div>
\t\t\t</a>
\t\t\t
\t\t\t<ul id="toc-GitHub_Flavored_Markdown-sublist" class="vector-toc-list">
\t\t\t</ul>
\t\t</li>
\t\t<li id="toc-Markdown_Extra"
\t\t\tclass="vector-toc-list-item vector-toc-level-2">
\t\t\t<a class="vector-toc-link" href="#Markdown_Extra">
\t\t\t\t<div class="vector-toc-text">
\t\t\t\t\t<span class="vector-toc-numb">4.2</span>
\t\t\t\t\t<span>Markdown Extra</span>
\t\t\t\t</div>
\t\t\t</a>
\t\t\t
\t\t\t<ul id="toc-Markdown_Extra-sublist" class="vector-toc-list">
\t\t\t</ul>
\t\t</li>
\t</ul>
\t</li>
\t<li id="toc-Examples"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Examples">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">5</span>
\t\t\t\t<span>Examples</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-Examples-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-Implementations"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Implementations">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">6</span>
\t\t\t\t<span>Implementations</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-Implementations-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-See_also"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#See_also">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">7</span>
\t\t\t\t<span>See also</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-See_also-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-Explanatory_notes"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#Explanatory_notes">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">8</span>
\t\t\t\t<span>Explanatory notes</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-Explanatory_notes-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-References"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#References">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">9</span>
\t\t\t\t<span>References</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-References-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
\t<li id="toc-External_links"
\t\tclass="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-expanded">
\t\t<a class="vector-toc-link" href="#External_links">
\t\t\t<div class="vector-toc-text">
\t\t\t\t<span class="vector-toc-numb">10</span>
\t\t\t\t<span>External links</span>
\t\t\t</div>
\t\t</a>
\t\t
\t\t<ul id="toc-External_links-sublist" class="vector-toc-list">
\t\t</ul>
\t</li>
</ul>
</div>

\t\t\t\t\t</div>
\t\t</nav>
\t\t\t</div>
\t\t</div>
\t\t<div class="mw-content-container">
\t\t\t<main id="content" class="mw-body">
\t\t\t\t<header class="mw-body-header vector-page-titlebar">
\t\t\t\t\t<nav aria-label="Contents" class="vector-toc-landmark">
\t\t\t\t\t\t
<div id="vector-page-titlebar-toc" class="vector-dropdown vector-page-titlebar-toc vector-button-flush-left"  title="Table of Contents" >
\t<input type="checkbox" id="vector-page-titlebar-toc-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-page-titlebar-toc" class="vector-dropdown-checkbox "  aria-label="Toggle the table of contents"  >
\t<label id="vector-page-titlebar-toc-label" for="vector-page-titlebar-toc-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only " aria-hidden="true"  ><span class="vector-icon mw-ui-icon-listBullet mw-ui-icon-wikimedia-listBullet"></span>

<span class="vector-dropdown-label-text">Toggle the table of contents</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t\t\t\t\t<div id="vector-page-titlebar-toc-unpinned-container" class="vector-unpinned-container">
\t\t\t</div>
\t\t
\t</div>
</div>

\t\t\t\t\t</nav>
\t\t\t\t\t<h1 id="firstHeading" class="firstHeading mw-first-heading"><span class="mw-page-title-main">Markdown</span></h1>
\t\t\t\t\t\t\t
<div id="p-lang-btn" class="vector-dropdown mw-portlet mw-portlet-lang"  >
\t<input type="checkbox" id="p-lang-btn-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-p-lang-btn" class="vector-dropdown-checkbox mw-interlanguage-selector" aria-label="Go to an article in another language. Available in 31 languages"   >
\t<label id="p-lang-btn-label" for="p-lang-btn-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--action-progressive mw-portlet-lang-heading-31" aria-hidden="true"  ><span class="vector-icon mw-ui-icon-language-progressive mw-ui-icon-wikimedia-language-progressive"></span>

<span class="vector-dropdown-label-text">31 languages</span>
\t</label>
\t<div class="vector-dropdown-content">

\t\t<div class="vector-menu-content">
\t\t\t
\t\t\t<ul class="vector-menu-content-list">
\t\t\t\t
\t\t\t\t<li class="interlanguage-link interwiki-als mw-list-item"><a href="https://als.wikipedia.org/wiki/Markdown" title="Markdown – Alemannic" lang="gsw" hreflang="gsw" data-title="Markdown" data-language-autonym="Alemannisch" data-language-local-name="Alemannic" class="interlanguage-link-target"><span>Alemannisch</span></a></li><li class="interlanguage-link interwiki-ar mw-list-item"><a href="https://ar.wikipedia.org/wiki/%D9%85%D8%A7%D8%B1%D9%83%D8%AF%D8%A7%D9%88%D9%86" title="ماركداون – Arabic" lang="ar" hreflang="ar" data-title="ماركداون" data-language-autonym="العربية" data-language-local-name="Arabic" class="interlanguage-link-target"><span>العربية</span></a></li><li class="interlanguage-link interwiki-bn mw-list-item"><a href="https://bn.wikipedia.org/wiki/%E0%A6%AE%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%95%E0%A6%A1%E0%A6%BE%E0%A6%89%E0%A6%A8" title="মার্কডাউন – Bangla" lang="bn" hreflang="bn" data-title="মার্কডাউন" data-language-autonym="বাংলা" data-language-local-name="Bangla" class="interlanguage-link-target"><span>বাংলা</span></a></li><li class="interlanguage-link interwiki-br mw-list-item"><a href="https://br.wikipedia.org/wiki/Markdown" title="Markdown – Breton" lang="br" hreflang="br" data-title="Markdown" data-language-autonym="Brezhoneg" data-language-local-name="Breton" class="interlanguage-link-target"><span>Brezhoneg</span></a></li><li class="interlanguage-link interwiki-ca mw-list-item"><a href="https://ca.wikipedia.org/wiki/Markdown" title="Markdown – Catalan" lang="ca" hreflang="ca" data-title="Markdown" data-language-autonym="Català" data-language-local-name="Catalan" class="interlanguage-link-target"><span>Català</span></a></li><li class="interlanguage-link interwiki-cs mw-list-item"><a href="https://cs.wikipedia.org/wiki/Markdown" title="Markdown – Czech" lang="cs" hreflang="cs" data-title="Markdown" data-language-autonym="Čeština" data-language-local-name="Czech" class="interlanguage-link-target"><span>Čeština</span></a></li><li class="interlanguage-link interwiki-de mw-list-item"><a href="https://de.wikipedia.org/wiki/Markdown" title="Markdown – German" lang="de" hreflang="de" data-title="Markdown" data-language-autonym="Deutsch" data-language-local-name="German" class="interlanguage-link-target"><span>Deutsch</span></a></li><li class="interlanguage-link interwiki-et mw-list-item"><a href="https://et.wikipedia.org/wiki/Markdown" title="Markdown – Estonian" lang="et" hreflang="et" data-title="Markdown" data-language-autonym="Eesti" data-language-local-name="Estonian" class="interlanguage-link-target"><span>Eesti</span></a></li><li class="interlanguage-link interwiki-es mw-list-item"><a href="https://es.wikipedia.org/wiki/Markdown" title="Markdown – Spanish" lang="es" hreflang="es" data-title="Markdown" data-language-autonym="Español" data-language-local-name="Spanish" class="interlanguage-link-target"><span>Español</span></a></li><li class="interlanguage-link interwiki-eu mw-list-item"><a href="https://eu.wikipedia.org/wiki/Markdown" title="Markdown – Basque" lang="eu" hreflang="eu" data-title="Markdown" data-language-autonym="Euskara" data-language-local-name="Basque" class="interlanguage-link-target"><span>Euskara</span></a></li><li class="interlanguage-link interwiki-fa mw-list-item"><a href="https://fa.wikipedia.org/wiki/%D9%85%D8%A7%D8%B1%DA%A9%E2%80%8C%D8%AF%D8%A7%D9%88%D9%86" title="مارک‌داون – Persian" lang="fa" hreflang="fa" data-title="مارک‌داون" data-language-autonym="فارسی" data-language-local-name="Persian" class="interlanguage-link-target"><span>فارسی</span></a></li><li class="interlanguage-link interwiki-fr mw-list-item"><a href="https://fr.wikipedia.org/wiki/Markdown" title="Markdown – French" lang="fr" hreflang="fr" data-title="Markdown" data-language-autonym="Français" data-language-local-name="French" class="interlanguage-link-target"><span>Français</span></a></li><li class="interlanguage-link interwiki-ko mw-list-item"><a href="https://ko.wikipedia.org/wiki/%EB%A7%88%ED%81%AC%EB%8B%A4%EC%9A%B4" title="마크다운 – Korean" lang="ko" hreflang="ko" data-title="마크다운" data-language-autonym="한국어" data-language-local-name="Korean" class="interlanguage-link-target"><span>한국어</span></a></li><li class="interlanguage-link interwiki-id mw-list-item"><a href="https://id.wikipedia.org/wiki/Markdown" title="Markdown – Indonesian" lang="id" hreflang="id" data-title="Markdown" data-language-autonym="Bahasa Indonesia" data-language-local-name="Indonesian" class="interlanguage-link-target"><span>Bahasa Indonesia</span></a></li><li class="interlanguage-link interwiki-is mw-list-item"><a href="https://is.wikipedia.org/wiki/Markdown" title="Markdown – Icelandic" lang="is" hreflang="is" data-title="Markdown" data-language-autonym="Íslenska" data-language-local-name="Icelandic" class="interlanguage-link-target"><span>Íslenska</span></a></li><li class="interlanguage-link interwiki-it mw-list-item"><a href="https://it.wikipedia.org/wiki/Markdown" title="Markdown – Italian" lang="it" hreflang="it" data-title="Markdown" data-language-autonym="Italiano" data-language-local-name="Italian" class="interlanguage-link-target"><span>Italiano</span></a></li><li class="interlanguage-link interwiki-he mw-list-item"><a href="https://he.wikipedia.org/wiki/Markdown" title="Markdown – Hebrew" lang="he" hreflang="he" data-title="Markdown" data-language-autonym="עברית" data-language-local-name="Hebrew" class="interlanguage-link-target"><span>עברית</span></a></li><li class="interlanguage-link interwiki-ku mw-list-item"><a href="https://ku.wikipedia.org/wiki/Markdown" title="Markdown – Kurdish" lang="ku" hreflang="ku" data-title="Markdown" data-language-autonym="Kurdî" data-language-local-name="Kurdish" class="interlanguage-link-target"><span>Kurdî</span></a></li><li class="interlanguage-link interwiki-hu mw-list-item"><a href="https://hu.wikipedia.org/wiki/Markdown" title="Markdown – Hungarian" lang="hu" hreflang="hu" data-title="Markdown" data-language-autonym="Magyar" data-language-local-name="Hungarian" class="interlanguage-link-target"><span>Magyar</span></a></li><li class="interlanguage-link interwiki-mn mw-list-item"><a href="https://mn.wikipedia.org/wiki/Markdown" title="Markdown – Mongolian" lang="mn" hreflang="mn" data-title="Markdown" data-language-autonym="Монгол" data-language-local-name="Mongolian" class="interlanguage-link-target"><span>Монгол</span></a></li><li class="interlanguage-link interwiki-nl mw-list-item"><a href="https://nl.wikipedia.org/wiki/Markdown" title="Markdown – Dutch" lang="nl" hreflang="nl" data-title="Markdown" data-language-autonym="Nederlands" data-language-local-name="Dutch" class="interlanguage-link-target"><span>Nederlands</span></a></li><li class="interlanguage-link interwiki-ja mw-list-item"><a href="https://ja.wikipedia.org/wiki/Markdown" title="Markdown – Japanese" lang="ja" hreflang="ja" data-title="Markdown" data-language-autonym="日本語" data-language-local-name="Japanese" class="interlanguage-link-target"><span>日本語</span></a></li><li class="interlanguage-link interwiki-pl mw-list-item"><a href="https://pl.wikipedia.org/wiki/Markdown" title="Markdown – Polish" lang="pl" hreflang="pl" data-title="Markdown" data-language-autonym="Polski" data-language-local-name="Polish" class="interlanguage-link-target"><span>Polski</span></a></li><li class="interlanguage-link interwiki-pt mw-list-item"><a href="https://pt.wikipedia.org/wiki/Markdown" title="Markdown – Portuguese" lang="pt" hreflang="pt" data-title="Markdown" data-language-autonym="Português" data-language-local-name="Portuguese" class="interlanguage-link-target"><span>Português</span></a></li><li class="interlanguage-link interwiki-ru mw-list-item"><a href="https://ru.wikipedia.org/wiki/Markdown" title="Markdown – Russian" lang="ru" hreflang="ru" data-title="Markdown" data-language-autonym="Русский" data-language-local-name="Russian" class="interlanguage-link-target"><span>Русский</span></a></li><li class="interlanguage-link interwiki-sv mw-list-item"><a href="https://sv.wikipedia.org/wiki/Markdown" title="Markdown – Swedish" lang="sv" hreflang="sv" data-title="Markdown" data-language-autonym="Svenska" data-language-local-name="Swedish" class="interlanguage-link-target"><span>Svenska</span></a></li><li class="interlanguage-link interwiki-th mw-list-item"><a href="https://th.wikipedia.org/wiki/%E0%B8%A1%E0%B8%B2%E0%B8%A3%E0%B9%8C%E0%B8%81%E0%B8%94%E0%B8%B2%E0%B8%A7%E0%B8%99%E0%B9%8C" title="มาร์กดาวน์ – Thai" lang="th" hreflang="th" data-title="มาร์กดาวน์" data-language-autonym="ไทย" data-language-local-name="Thai" class="interlanguage-link-target"><span>ไทย</span></a></li><li class="interlanguage-link interwiki-tr mw-list-item"><a href="https://tr.wikipedia.org/wiki/Markdown" title="Markdown – Turkish" lang="tr" hreflang="tr" data-title="Markdown" data-language-autonym="Türkçe" data-language-local-name="Turkish" class="interlanguage-link-target"><span>Türkçe</span></a></li><li class="interlanguage-link interwiki-uk mw-list-item"><a href="https://uk.wikipedia.org/wiki/Markdown" title="Markdown – Ukrainian" lang="uk" hreflang="uk" data-title="Markdown" data-language-autonym="Українська" data-language-local-name="Ukrainian" class="interlanguage-link-target"><span>Українська</span></a></li><li class="interlanguage-link interwiki-vi mw-list-item"><a href="https://vi.wikipedia.org/wiki/Markdown" title="Markdown – Vietnamese" lang="vi" hreflang="vi" data-title="Markdown" data-language-autonym="Tiếng Việt" data-language-local-name="Vietnamese" class="interlanguage-link-target"><span>Tiếng Việt</span></a></li><li class="interlanguage-link interwiki-zh mw-list-item"><a href="https://zh.wikipedia.org/wiki/Markdown" title="Markdown – Chinese" lang="zh" hreflang="zh" data-title="Markdown" data-language-autonym="中文" data-language-local-name="Chinese" class="interlanguage-link-target"><span>中文</span></a></li>
\t\t\t</ul>
\t\t\t<div class="after-portlet after-portlet-lang"><span class="wb-langlinks-edit wb-langlinks-link"><a href="https://www.wikidata.org/wiki/Special:EntityPage/Q1193600#sitelinks-wikipedia" title="Edit interlanguage links" class="wbc-editpage">Edit links</a></span></div>
\t\t</div>

\t</div>
</div>
</header>
\t\t\t\t<div class="vector-page-toolbar">
\t\t\t\t\t<div class="vector-page-toolbar-container">
\t\t\t\t\t\t<div id="left-navigation">
\t\t\t\t\t\t\t<nav aria-label="Namespaces">
\t\t\t\t\t\t\t\t
<div id="p-associated-pages" class="vector-menu vector-menu-tabs mw-portlet mw-portlet-associated-pages"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="ca-nstab-main" class="selected vector-tab-noicon mw-list-item"><a href="/wiki/Markdown" title="View the content page [c]" accesskey="c"><span>Article</span></a></li><li id="ca-talk" class="vector-tab-noicon mw-list-item"><a href="/wiki/Talk:Markdown" rel="discussion" title="Discuss improvements to the content page [t]" accesskey="t"><span>Talk</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

\t\t\t\t\t\t\t\t
<div id="vector-variants-dropdown" class="vector-dropdown emptyPortlet"  >
\t<input type="checkbox" id="vector-variants-dropdown-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-variants-dropdown" class="vector-dropdown-checkbox " aria-label="Change language variant"   >
\t<label id="vector-variants-dropdown-label" for="vector-variants-dropdown-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet" aria-hidden="true"  ><span class="vector-dropdown-label-text">English</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t\t\t
<div id="p-variants" class="vector-menu mw-portlet mw-portlet-variants emptyPortlet"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t
\t\t</ul>
\t\t
\t</div>
</div>

\t\t\t\t
\t</div>
</div>

\t\t\t\t\t\t\t</nav>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div id="right-navigation" class="vector-collapsible">
\t\t\t\t\t\t\t<nav aria-label="Views">
\t\t\t\t\t\t\t\t
<div id="p-views" class="vector-menu vector-menu-tabs mw-portlet mw-portlet-views"  >
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="ca-view" class="selected vector-tab-noicon mw-list-item"><a href="/wiki/Markdown"><span>Read</span></a></li><li id="ca-edit" class="vector-tab-noicon mw-list-item"><a href="/w/index.php?title=Markdown&amp;action=edit" title="Edit this page [e]" accesskey="e"><span>Edit</span></a></li><li id="ca-history" class="vector-tab-noicon mw-list-item"><a href="/w/index.php?title=Markdown&amp;action=history" title="Past revisions of this page [h]" accesskey="h"><span>View history</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

\t\t\t\t\t\t\t</nav>
\t\t\t\t
\t\t\t\t\t\t\t<nav class="vector-page-tools-landmark" aria-label="Page tools">
\t\t\t\t\t\t\t\t
<div id="vector-page-tools-dropdown" class="vector-dropdown vector-page-tools-dropdown"  >
\t<input type="checkbox" id="vector-page-tools-dropdown-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-page-tools-dropdown" class="vector-dropdown-checkbox "  aria-label="Tools"  >
\t<label id="vector-page-tools-dropdown-label" for="vector-page-tools-dropdown-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet" aria-hidden="true"  ><span class="vector-dropdown-label-text">Tools</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t\t\t\t\t\t\t<div id="vector-page-tools-unpinned-container" class="vector-unpinned-container">
\t\t\t\t\t\t
<div id="vector-page-tools" class="vector-page-tools vector-pinnable-element">
\t<div
\tclass="vector-pinnable-header vector-page-tools-pinnable-header vector-pinnable-header-unpinned"
\tdata-feature-name="page-tools-pinned"
\tdata-pinnable-element-id="vector-page-tools"
\tdata-pinned-container-id="vector-page-tools-pinned-container"
\tdata-unpinned-container-id="vector-page-tools-unpinned-container"
>
\t<div class="vector-pinnable-header-label">Tools</div>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button" data-event-name="pinnable-header.vector-page-tools.pin">move to sidebar</button>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button" data-event-name="pinnable-header.vector-page-tools.unpin">hide</button>
</div>

\t
<div id="p-cactions" class="vector-menu mw-portlet mw-portlet-cactions emptyPortlet vector-has-collapsible-items"  title="More options" >
\t<div class="vector-menu-heading">
\t\tActions
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="ca-more-view" class="selected vector-more-collapsible-item mw-list-item"><a href="/wiki/Markdown"><span>Read</span></a></li><li id="ca-more-edit" class="vector-more-collapsible-item mw-list-item"><a href="/w/index.php?title=Markdown&amp;action=edit" title="Edit this page [e]" accesskey="e"><span>Edit</span></a></li><li id="ca-more-history" class="vector-more-collapsible-item mw-list-item"><a href="/w/index.php?title=Markdown&amp;action=history"><span>View history</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

<div id="p-tb" class="vector-menu mw-portlet mw-portlet-tb"  >
\t<div class="vector-menu-heading">
\t\tGeneral
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="t-whatlinkshere" class="mw-list-item"><a href="/wiki/Special:WhatLinksHere/Markdown" title="List of all English Wikipedia pages containing links to this page [j]" accesskey="j"><span>What links here</span></a></li><li id="t-recentchangeslinked" class="mw-list-item"><a href="/wiki/Special:RecentChangesLinked/Markdown" rel="nofollow" title="Recent changes in pages linked from this page [k]" accesskey="k"><span>Related changes</span></a></li><li id="t-upload" class="mw-list-item"><a href="//en.wikipedia.org/wiki/Wikipedia:File_Upload_Wizard" title="Upload files [u]" accesskey="u"><span>Upload file</span></a></li><li id="t-permalink" class="mw-list-item"><a href="/w/index.php?title=Markdown&amp;oldid=1285991210" title="Permanent link to this revision of this page"><span>Permanent link</span></a></li><li id="t-info" class="mw-list-item"><a href="/w/index.php?title=Markdown&amp;action=info" title="More information about this page"><span>Page information</span></a></li><li id="t-cite" class="mw-list-item"><a href="/w/index.php?title=Special:CiteThisPage&amp;page=Markdown&amp;id=1285991210&amp;wpFormIdentifier=titleform" title="Information on how to cite this page"><span>Cite this page</span></a></li><li id="t-urlshortener" class="mw-list-item"><a href="/w/index.php?title=Special:UrlShortener&amp;url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FMarkdown"><span>Get shortened URL</span></a></li><li id="t-urlshortener-qrcode" class="mw-list-item"><a href="/w/index.php?title=Special:QrCode&amp;url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FMarkdown"><span>Download QR code</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

<div id="p-coll-print_export" class="vector-menu mw-portlet mw-portlet-coll-print_export"  >
\t<div class="vector-menu-heading">
\t\tPrint/export
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li id="coll-download-as-rl" class="mw-list-item"><a href="/w/index.php?title=Special:DownloadAsPdf&amp;page=Markdown&amp;action=show-download-screen" title="Download this page as a PDF file"><span>Download as PDF</span></a></li><li id="t-print" class="mw-list-item"><a href="/w/index.php?title=Markdown&amp;printable=yes" title="Printable version of this page [p]" accesskey="p"><span>Printable version</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

<div id="p-wikibase-otherprojects" class="vector-menu mw-portlet mw-portlet-wikibase-otherprojects"  >
\t<div class="vector-menu-heading">
\t\tIn other projects
\t</div>
\t<div class="vector-menu-content">
\t\t
\t\t<ul class="vector-menu-content-list">
\t\t\t
\t\t\t<li class="wb-otherproject-link wb-otherproject-commons mw-list-item"><a href="https://commons.wikimedia.org/wiki/Category:Markdown" hreflang="en"><span>Wikimedia Commons</span></a></li><li class="wb-otherproject-link wb-otherproject-wikibooks mw-list-item"><a href="https://en.wikibooks.org/wiki/Markdown" hreflang="en"><span>Wikibooks</span></a></li><li id="t-wikibase" class="wb-otherproject-link wb-otherproject-wikibase-dataitem mw-list-item"><a href="https://www.wikidata.org/wiki/Special:EntityPage/Q1193600" title="Structured data on this page hosted by Wikidata [g]" accesskey="g"><span>Wikidata item</span></a></li>
\t\t</ul>
\t\t
\t</div>
</div>

</div>

\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t
\t</div>
</div>

\t\t\t\t\t\t\t</nav>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t\t<div class="vector-column-end">
\t\t\t\t\t<div class="vector-sticky-pinned-container">
\t\t\t\t\t\t<nav class="vector-page-tools-landmark" aria-label="Page tools">
\t\t\t\t\t\t\t<div id="vector-page-tools-pinned-container" class="vector-pinned-container">
\t\t\t\t
\t\t\t\t\t\t\t</div>
\t\t</nav>
\t\t\t\t\t\t<nav class="vector-appearance-landmark" aria-label="Appearance">
\t\t\t\t\t\t\t<div id="vector-appearance-pinned-container" class="vector-pinned-container">
\t\t\t\t<div id="vector-appearance" class="vector-appearance vector-pinnable-element">
\t<div
\tclass="vector-pinnable-header vector-appearance-pinnable-header vector-pinnable-header-pinned"
\tdata-feature-name="appearance-pinned"
\tdata-pinnable-element-id="vector-appearance"
\tdata-pinned-container-id="vector-appearance-pinned-container"
\tdata-unpinned-container-id="vector-appearance-unpinned-container"
>
\t<div class="vector-pinnable-header-label">Appearance</div>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button" data-event-name="pinnable-header.vector-appearance.pin">move to sidebar</button>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button" data-event-name="pinnable-header.vector-appearance.unpin">hide</button>
</div>


</div>

\t\t\t\t\t\t\t</div>
\t\t</nav>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t\t<div id="bodyContent" class="vector-body" aria-labelledby="firstHeading" data-mw-ve-target-container>
\t\t\t\t\t<div class="vector-body-before-content">
\t\t\t\t\t\t\t<div class="mw-indicators">
\t\t</div>

\t\t\t\t\t\t<div id="siteSub" class="noprint">From Wikipedia, the free encyclopedia</div>
\t\t\t\t\t</div>
\t\t\t\t\t<div id="contentSub"><div id="mw-content-subtitle"></div></div>
\t\t\t\t\t
\t\t\t\t\t
\t\t\t\t\t<div id="mw-content-text" class="mw-body-content"><div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><div class="shortdescription nomobile noexcerpt noprint searchaux" style="display:none">Plain text markup language</div>
<style data-mw-deduplicate="TemplateStyles:r1236090951">.mw-parser-output .hatnote{font-style:italic}.mw-parser-output div.hatnote{padding-left:1.6em;margin-bottom:0.5em}.mw-parser-output .hatnote i{font-style:normal}.mw-parser-output .hatnote+link+.hatnote{margin-top:-0.5em}@media print{body.ns-0 .mw-parser-output .hatnote{display:none!important}}</style><div role="note" class="hatnote navigation-not-searchable">For the marketing term, see <a href="/wiki/Price_markdown" title="Price markdown">Price markdown</a>.</div>
<style data-mw-deduplicate="TemplateStyles:r1257001546">.mw-parser-output .infobox-subbox{padding:0;border:none;margin:-3px;width:auto;min-width:100%;font-size:100%;clear:none;float:none;background-color:transparent}.mw-parser-output .infobox-3cols-child{margin:auto}.mw-parser-output .infobox .navbar{font-size:100%}@media screen{html.skin-theme-clientpref-night .mw-parser-output .infobox-full-data:not(.notheme)>div:not(.notheme)[style]{background:#1f1f23!important;color:#f8f9fa}}@media screen and (prefers-color-scheme:dark){html.skin-theme-clientpref-os .mw-parser-output .infobox-full-data:not(.notheme) div:not(.notheme){background:#1f1f23!important;color:#f8f9fa}}@media(min-width:640px){body.skin--responsive .mw-parser-output .infobox-table{display:table!important}body.skin--responsive .mw-parser-output .infobox-table>caption{display:table-caption!important}body.skin--responsive .mw-parser-output .infobox-table>tbody{display:table-row-group}body.skin--responsive .mw-parser-output .infobox-table tr{display:table-row!important}body.skin--responsive .mw-parser-output .infobox-table th,body.skin--responsive .mw-parser-output .infobox-table td{padding-left:inherit;padding-right:inherit}}</style><table class="infobox"><caption class="infobox-title" style="padding-bottom: 0.15em;">Markdown</caption><tbody><tr><td colspan="2" class="infobox-image"><span class="skin-invert" typeof="mw:File"><a href="/wiki/File:Markdown-mark.svg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/175px-Markdown-mark.svg.png" decoding="async" width="175" height="108" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/263px-Markdown-mark.svg.png 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/350px-Markdown-mark.svg.png 2x" data-file-width="208" data-file-height="128" /></a></span></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Filename_extension" title="Filename extension">Filename extensions</a></th><td class="infobox-data" style="line-height: 1.35;"><style data-mw-deduplicate="TemplateStyles:r886049734">.mw-parser-output .monospaced{font-family:monospace,monospace}</style><div class="monospaced">
<code>.md</code>, <code>.markdown</code><sup id="cite_ref-df-2022_1-0" class="reference"><a href="#cite_note-df-2022-1"><span class="cite-bracket">&#91;</span>1<span class="cite-bracket">&#93;</span></a></sup><sup id="cite_ref-rfc7763_2-0" class="reference"><a href="#cite_note-rfc7763-2"><span class="cite-bracket">&#91;</span>2<span class="cite-bracket">&#93;</span></a></sup></div></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Media_type" title="Media type">Internet media&#160;type</a></th><td class="infobox-data" style="line-height: 1.35;"><code>text/markdown</code><sup id="cite_ref-rfc7763_2-1" class="reference"><a href="#cite_note-rfc7763-2"><span class="cite-bracket">&#91;</span>2<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Uniform_Type_Identifier" title="Uniform Type Identifier">Uniform Type Identifier&#160;(UTI)</a></th><td class="infobox-data" style="line-height: 1.35;"><code>net.daringfireball.markdown</code></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Developed&#160;by</th><td class="infobox-data" style="line-height: 1.35;"><style data-mw-deduplicate="TemplateStyles:r1126788409">.mw-parser-output .plainlist ol,.mw-parser-output .plainlist ul{line-height:inherit;list-style:none;margin:0;padding:0}.mw-parser-output .plainlist ol li,.mw-parser-output .plainlist ul li{margin-bottom:0}</style><div class="plainlist">
<ul><li><a href="/wiki/John_Gruber" title="John Gruber">John Gruber</a></li></ul>
</div></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Initial release</th><td class="infobox-data" style="line-height: 1.35;">March&#160;9, 2004<span class="noprint">&#32;(21 years ago)</span><span style="display:none">&#160;(<span class="bday dtstart published updated">2004-03-09</span>)</span><sup id="cite_ref-markdown-swartz_3-0" class="reference"><a href="#cite_note-markdown-swartz-3"><span class="cite-bracket">&#91;</span>3<span class="cite-bracket">&#93;</span></a></sup><sup id="cite_ref-gruber-2004-release_4-0" class="reference"><a href="#cite_note-gruber-2004-release-4"><span class="cite-bracket">&#91;</span>4<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Software_release_life_cycle" title="Software release life cycle">Latest release</a></th><td class="infobox-data" style="line-height: 1.35;"><div style="display: inline-block; line-height: 1.2em; padding: .1em 0;">1.0.1<br />December&#160;17, 2004<span class="noprint">&#32;(20 years ago)</span><span style="display:none">&#160;(<span class="bday dtstart published updated">2004-12-17</span>)</span><sup id="cite_ref-md_5-0" class="reference"><a href="#cite_note-md-5"><span class="cite-bracket">&#91;</span>5<span class="cite-bracket">&#93;</span></a></sup> </div></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Type of format</th><td class="infobox-data" style="line-height: 1.35;"><a href="/wiki/Open_file_format" title="Open file format">Open file format</a><sup id="cite_ref-license_6-0" class="reference"><a href="#cite_note-license-6"><span class="cite-bracket">&#91;</span>6<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Extended&#160;to</th><td class="infobox-data" style="line-height: 1.35;"><a href="/wiki/Pandoc" title="Pandoc">pandoc</a>, <a href="/wiki/MultiMarkdown" title="MultiMarkdown">MultiMarkdown</a>, <a href="/wiki/Markdown_Extra" class="mw-redirect" title="Markdown Extra">Markdown Extra</a>, <a href="#Standardization">CommonMark</a>,<sup id="cite_ref-rfc7764_7-0" class="reference"><a href="#cite_note-rfc7764-7"><span class="cite-bracket">&#91;</span>7<span class="cite-bracket">&#93;</span></a></sup> <a href="/wiki/RMarkdown" class="mw-redirect" title="RMarkdown">RMarkdown</a><sup id="cite_ref-RMarkdown_8-0" class="reference"><a href="#cite_note-RMarkdown-8"><span class="cite-bracket">&#91;</span>8<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Website</th><td class="infobox-data" style="line-height: 1.35;"><span class="url"><a rel="nofollow" class="external text" href="https://daringfireball.net/projects/markdown/">daringfireball<wbr />.net<wbr />/projects<wbr />/markdown<wbr />/</a></span></td></tr></tbody></table>
<p><b>Markdown</b><sup id="cite_ref-philosophy_9-0" class="reference"><a href="#cite_note-philosophy-9"><span class="cite-bracket">&#91;</span>9<span class="cite-bracket">&#93;</span></a></sup> is a <a href="/wiki/Lightweight_markup_language" title="Lightweight markup language">lightweight markup language</a> for creating <a href="/wiki/Formatted_text" title="Formatted text">formatted text</a> using a <a href="/wiki/Text_editor" title="Text editor">plain-text editor</a>. <a href="/wiki/John_Gruber" title="John Gruber">John Gruber</a> created Markdown in 2004 as an easy-to-read <a href="/wiki/Markup_language" title="Markup language">markup language</a>.<sup id="cite_ref-philosophy_9-1" class="reference"><a href="#cite_note-philosophy-9"><span class="cite-bracket">&#91;</span>9<span class="cite-bracket">&#93;</span></a></sup> Markdown is widely used for <a href="/wiki/Blog" title="Blog">blogging</a> and <a href="/wiki/Instant_messaging" title="Instant messaging">instant messaging</a>, and also used elsewhere in <a href="/wiki/Online_forums" class="mw-redirect" title="Online forums">online forums</a>, <a href="/wiki/Collaborative_software" title="Collaborative software">collaborative software</a>, <a href="/wiki/Documentation" title="Documentation">documentation</a> pages, and <a href="/wiki/README" title="README">readme files</a>.
</p><p>The initial description of Markdown<sup id="cite_ref-10" class="reference"><a href="#cite_note-10"><span class="cite-bracket">&#91;</span>10<span class="cite-bracket">&#93;</span></a></sup> contained ambiguities and raised unanswered questions, causing implementations to both intentionally and accidentally diverge from the original version. This was addressed in 2014 when long-standing Markdown contributors released <a href="#Standardization">CommonMark</a>, an unambiguous specification and test suite for Markdown.<sup id="cite_ref-FutureOfMarkdown_11-0" class="reference"><a href="#cite_note-FutureOfMarkdown-11"><span class="cite-bracket">&#91;</span>11<span class="cite-bracket">&#93;</span></a></sup>
</p>
<meta property="mw:PageProp/toc" />
<div class="mw-heading mw-heading2"><h2 id="History">History</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=1" title="Edit section: History"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>Markdown was inspired by pre-existing <a href="/wiki/Convention_(norm)" title="Convention (norm)">conventions</a> for marking up <a href="/wiki/Plain_text" title="Plain text">plain text</a> in <a href="/wiki/Email" title="Email">email</a> and <a href="/wiki/Usenet" title="Usenet">usenet</a> posts,<sup id="cite_ref-ArsTechnica2014_12-0" class="reference"><a href="#cite_note-ArsTechnica2014-12"><span class="cite-bracket">&#91;</span>12<span class="cite-bracket">&#93;</span></a></sup> such as the earlier markup languages <a href="/wiki/Setext" title="Setext">setext</a> (<abbr title="circa">c.</abbr><span style="white-space:nowrap;">&#8201;1992</span>), <a href="/wiki/Textile_(markup_language)" title="Textile (markup language)">Textile</a> (c.&#160;2002), and <a href="/wiki/ReStructuredText" title="ReStructuredText">reStructuredText</a> (c.&#160;2002).<sup id="cite_ref-philosophy_9-2" class="reference"><a href="#cite_note-philosophy-9"><span class="cite-bracket">&#91;</span>9<span class="cite-bracket">&#93;</span></a></sup>
</p><p>In 2002 <a href="/wiki/Aaron_Swartz" title="Aaron Swartz">Aaron Swartz</a> created <a href="/wiki/Atx_(markup_language)" class="mw-redirect" title="Atx (markup language)">atx</a> and referred to it as "the true structured text format". Gruber created the Markdown language in 2004 with Swartz as his "sounding board".<sup id="cite_ref-Gruber_13-0" class="reference"><a href="#cite_note-Gruber-13"><span class="cite-bracket">&#91;</span>13<span class="cite-bracket">&#93;</span></a></sup> The goal of the language was to enable people "to write using an easy-to-read and easy-to-write plain text format, optionally convert it to structurally valid <a href="/wiki/XHTML" title="XHTML">XHTML</a> (or <a href="/wiki/HTML" title="HTML">HTML</a>)".<sup id="cite_ref-md_5-1" class="reference"><a href="#cite_note-md-5"><span class="cite-bracket">&#91;</span>5<span class="cite-bracket">&#93;</span></a></sup>
</p><p>Another key design goal was <i>readability</i>, that the language be readable as-is, without looking like it has been marked up with tags or formatting instructions,<sup id="cite_ref-philosophy_9-3" class="reference"><a href="#cite_note-philosophy-9"><span class="cite-bracket">&#91;</span>9<span class="cite-bracket">&#93;</span></a></sup> unlike text formatted with "heavier" <a href="/wiki/Markup_language" title="Markup language">markup languages</a>, such as <a href="/wiki/Rich_Text_Format" title="Rich Text Format">Rich Text Format</a> (RTF), HTML, or even <a href="/wiki/Wikitext" class="mw-redirect" title="Wikitext">wikitext</a> (each of which have obvious in-line tags and formatting instructions which can make the text more difficult for humans to read).
</p><p>Gruber wrote a <a href="/wiki/Perl" title="Perl">Perl</a> script, <code class="mw-highlight mw-highlight-lang-text mw-content-ltr" style="" dir="ltr">Markdown.pl</code>, which converts marked-up text input to valid, <a href="/wiki/Well-formed_document" title="Well-formed document">well-formed</a> XHTML or HTML, encoding angle brackets (<code class="mw-highlight mw-highlight-lang-text mw-content-ltr" style="" dir="ltr">&lt;</code>, <code class="mw-highlight mw-highlight-lang-text mw-content-ltr" style="" dir="ltr">&gt;</code>) and <a href="/wiki/Ampersand" title="Ampersand">ampersands</a> (<code class="mw-highlight mw-highlight-lang-text mw-content-ltr" style="" dir="ltr">&amp;</code>), which would be misinterpreted as special characters in those languages. It can take the role of a standalone script, a plugin for <a href="/wiki/Blosxom" title="Blosxom">Blosxom</a> or a <a href="/wiki/Movable_Type" title="Movable Type">Movable Type</a>, or of a text filter for <a href="/wiki/BBEdit" title="BBEdit">BBEdit</a>.<sup id="cite_ref-md_5-2" class="reference"><a href="#cite_note-md-5"><span class="cite-bracket">&#91;</span>5<span class="cite-bracket">&#93;</span></a></sup>
</p>
<div class="mw-heading mw-heading2"><h2 id="Rise_and_divergence">Rise and divergence</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=2" title="Edit section: Rise and divergence"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>As Markdown's popularity grew rapidly, many Markdown <a href="/wiki/Implementation" title="Implementation">implementations</a> appeared, driven mostly by the need for additional features such as <a href="/wiki/Table_(information)" title="Table (information)">tables</a>, <a href="/wiki/Note_(typography)" title="Note (typography)">footnotes</a>, definition lists,<sup id="cite_ref-16" class="reference"><a href="#cite_note-16"><span class="cite-bracket">&#91;</span>note 1<span class="cite-bracket">&#93;</span></a></sup> and Markdown inside HTML blocks.
</p><p>The behavior of some of these diverged from the reference implementation, as Markdown was only characterised by an informal <a href="/wiki/Specification_(technical_standard)" title="Specification (technical standard)">specification</a><sup id="cite_ref-17" class="reference"><a href="#cite_note-17"><span class="cite-bracket">&#91;</span>16<span class="cite-bracket">&#93;</span></a></sup> and a <a href="/wiki/Perl" title="Perl">Perl</a> implementation for conversion to HTML.
</p><p>At the same time, a number of ambiguities in the informal specification had attracted attention.<sup id="cite_ref-gfm_on_github-why_spec_18-0" class="reference"><a href="#cite_note-gfm_on_github-why_spec-18"><span class="cite-bracket">&#91;</span>17<span class="cite-bracket">&#93;</span></a></sup>  These issues spurred the creation of tools such as Babelmark<sup id="cite_ref-babelmark-2_19-0" class="reference"><a href="#cite_note-babelmark-2-19"><span class="cite-bracket">&#91;</span>18<span class="cite-bracket">&#93;</span></a></sup><sup id="cite_ref-babelmark-3_20-0" class="reference"><a href="#cite_note-babelmark-3-20"><span class="cite-bracket">&#91;</span>19<span class="cite-bracket">&#93;</span></a></sup> to compare the output of various implementations,<sup id="cite_ref-21" class="reference"><a href="#cite_note-21"><span class="cite-bracket">&#91;</span>20<span class="cite-bracket">&#93;</span></a></sup> and an effort by some developers of Markdown <a href="/wiki/Parsing" title="Parsing">parsers</a> for standardisation. However, Gruber has argued that complete standardization would be a mistake: "Different sites (and people) have different needs. No one syntax would make all happy."<sup id="cite_ref-22" class="reference"><a href="#cite_note-22"><span class="cite-bracket">&#91;</span>21<span class="cite-bracket">&#93;</span></a></sup>
</p><p>Gruber avoided using curly braces in Markdown to unofficially reserve them for implementation-specific extensions.<sup id="cite_ref-curlyBraces_23-0" class="reference"><a href="#cite_note-curlyBraces-23"><span class="cite-bracket">&#91;</span>22<span class="cite-bracket">&#93;</span></a></sup>
</p>
<div class="mw-heading mw-heading2"><h2 id="Standardization">Standardization</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=3" title="Edit section: Standardization"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1257001546" /><table class="infobox"><caption class="infobox-title" style="padding-bottom: 0.15em;">CommonMark</caption><tbody><tr><td colspan="2" class="infobox-image"><span class="skin-invert" typeof="mw:File"><a href="/wiki/File:Markdown-mark.svg" class="mw-file-description"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/175px-Markdown-mark.svg.png" decoding="async" width="175" height="108" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/263px-Markdown-mark.svg.png 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/350px-Markdown-mark.svg.png 2x" data-file-width="208" data-file-height="128" /></a></span></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Filename_extension" title="Filename extension">Filename extensions</a></th><td class="infobox-data" style="line-height: 1.35;"><code>.md</code>, <code>.markdown</code><sup id="cite_ref-rfc7763_2-2" class="reference"><a href="#cite_note-rfc7763-2"><span class="cite-bracket">&#91;</span>2<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Media_type" title="Media type">Internet media&#160;type</a></th><td class="infobox-data" style="line-height: 1.35;"><code>text/markdown; variant=CommonMark</code><sup id="cite_ref-rfc7764_7-1" class="reference"><a href="#cite_note-rfc7764-7"><span class="cite-bracket">&#91;</span>7<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Uniform_Type_Identifier" title="Uniform Type Identifier">Uniform Type Identifier&#160;(UTI)</a></th><td class="infobox-data" style="line-height: 1.35;"><i>uncertain</i><sup id="cite_ref-cm-uti_24-0" class="reference"><a href="#cite_note-cm-uti-24"><span class="cite-bracket">&#91;</span>23<span class="cite-bracket">&#93;</span></a></sup></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">UTI&#160;conformation</th><td class="infobox-data" style="line-height: 1.35;">public.plain-text</td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Developed&#160;by</th><td class="infobox-data" style="line-height: 1.35;"><a href="/wiki/John_MacFarlane_(philosopher)" title="John MacFarlane (philosopher)">John MacFarlane</a>, open source</td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Initial release</th><td class="infobox-data" style="line-height: 1.35;">October&#160;25, 2014<span class="noprint">&#32;(10 years ago)</span><span style="display:none">&#160;(<span class="bday dtstart published updated">2014-10-25</span>)</span></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;"><a href="/wiki/Software_release_life_cycle" title="Software release life cycle">Latest release</a></th><td class="infobox-data" style="line-height: 1.35;"><div style="display: inline-block; line-height: 1.2em; padding: .1em 0;">0.31.2<br />January&#160;28, 2024<span class="noprint">&#32;(14 months ago)</span><span style="display:none">&#160;(<span class="bday dtstart published updated">2024-01-28</span>)</span><sup id="cite_ref-cm-spec_25-0" class="reference"><a href="#cite_note-cm-spec-25"><span class="cite-bracket">&#91;</span>24<span class="cite-bracket">&#93;</span></a></sup> </div></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Type of format</th><td class="infobox-data" style="line-height: 1.35;"><a href="/wiki/Open_file_format" title="Open file format">Open file format</a></td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Extended&#160;from</th><td class="infobox-data" style="line-height: 1.35;">Markdown</td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Extended&#160;to</th><td class="infobox-data" style="line-height: 1.35;">GitHub Flavored Markdown</td></tr><tr><th scope="row" class="infobox-label" style="line-height: 1.2; padding-right: 0.65em;">Website</th><td class="infobox-data" style="line-height: 1.35;"><span class="url"><a rel="nofollow" class="external text" href="https://commonmark.org/">commonmark<wbr />.org</a></span>
<span class="url"><a rel="nofollow" class="external text" href="http://spec.commonmark.org/">spec<wbr />.commonmark<wbr />.org</a></span></td></tr></tbody></table>
<p>From 2012, a group of people, including <a href="/wiki/Jeff_Atwood" title="Jeff Atwood">Jeff Atwood</a> and <a href="/wiki/John_MacFarlane_(philosopher)" title="John MacFarlane (philosopher)">John MacFarlane</a>, launched what Atwood characterised as a standardisation effort.<sup id="cite_ref-FutureOfMarkdown_11-1" class="reference"><a href="#cite_note-FutureOfMarkdown-11"><span class="cite-bracket">&#91;</span>11<span class="cite-bracket">&#93;</span></a></sup>
</p><p>A community website now aims to "document various tools and resources available to document authors and developers, as well as implementors of the various Markdown implementations".<sup id="cite_ref-26" class="reference"><a href="#cite_note-26"><span class="cite-bracket">&#91;</span>25<span class="cite-bracket">&#93;</span></a></sup>
</p><p>In September 2014, Gruber objected to the usage of "Markdown" in the name of this effort and it was rebranded as CommonMark.<sup id="cite_ref-ArsTechnica2014_12-1" class="reference"><a href="#cite_note-ArsTechnica2014-12"><span class="cite-bracket">&#91;</span>12<span class="cite-bracket">&#93;</span></a></sup><sup id="cite_ref-27" class="reference"><a href="#cite_note-27"><span class="cite-bracket">&#91;</span>26<span class="cite-bracket">&#93;</span></a></sup><sup id="cite_ref-28" class="reference"><a href="#cite_note-28"><span class="cite-bracket">&#91;</span>27<span class="cite-bracket">&#93;</span></a></sup> CommonMark.org published several versions of a specification, reference implementation, test suite, and "[plans] to announce a finalized 1.0 spec and test suite in 2019".<sup id="cite_ref-commonmark.org_29-0" class="reference"><a href="#cite_note-commonmark.org-29"><span class="cite-bracket">&#91;</span>28<span class="cite-bracket">&#93;</span></a></sup>
</p><p>No 1.0 spec has since been released, as major issues still remain unsolved.<sup id="cite_ref-30" class="reference"><a href="#cite_note-30"><span class="cite-bracket">&#91;</span>29<span class="cite-bracket">&#93;</span></a></sup>
</p><p>Nonetheless, the following websites and projects have adopted CommonMark: <a href="/wiki/Discourse_(software)" title="Discourse (software)">Discourse</a>, <a href="/wiki/GitHub" title="GitHub">GitHub</a>, <a href="/wiki/GitLab" title="GitLab">GitLab</a>, <a href="/wiki/Reddit" title="Reddit">Reddit</a>, <a href="/wiki/Qt_(software)" title="Qt (software)">Qt</a>, <a href="/wiki/Stack_Exchange" title="Stack Exchange">Stack Exchange</a> (<a href="/wiki/Stack_Overflow" title="Stack Overflow">Stack Overflow</a>), and <a href="/wiki/Swift_(programming_language)" title="Swift (programming language)">Swift</a>.
</p><p>In March 2016, two relevant informational Internet <a href="/wiki/Request_for_Comments" title="Request for Comments">RFCs</a> were published:
</p>
<ul><li><style data-mw-deduplicate="TemplateStyles:r1238218222">.mw-parser-output cite.citation{font-style:inherit;word-wrap:break-word}.mw-parser-output .citation q{quotes:"\\"""\\"""'""'"}.mw-parser-output .citation:target{background-color:rgba(0,127,255,0.133)}.mw-parser-output .id-lock-free.id-lock-free a{background:url("//upload.wikimedia.org/wikipedia/commons/6/65/Lock-green.svg")right 0.1em center/9px no-repeat}.mw-parser-output .id-lock-limited.id-lock-limited a,.mw-parser-output .id-lock-registration.id-lock-registration a{background:url("//upload.wikimedia.org/wikipedia/commons/d/d6/Lock-gray-alt-2.svg")right 0.1em center/9px no-repeat}.mw-parser-output .id-lock-subscription.id-lock-subscription a{background:url("//upload.wikimedia.org/wikipedia/commons/a/aa/Lock-red-alt-2.svg")right 0.1em center/9px no-repeat}.mw-parser-output .cs1-ws-icon a{background:url("//upload.wikimedia.org/wikipedia/commons/4/4c/Wikisource-logo.svg")right 0.1em center/12px no-repeat}body:not(.skin-timeless):not(.skin-minerva) .mw-parser-output .id-lock-free a,body:not(.skin-timeless):not(.skin-minerva) .mw-parser-output .id-lock-limited a,body:not(.skin-timeless):not(.skin-minerva) .mw-parser-output .id-lock-registration a,body:not(.skin-timeless):not(.skin-minerva) .mw-parser-output .id-lock-subscription a,body:not(.skin-timeless):not(.skin-minerva) .mw-parser-output .cs1-ws-icon a{background-size:contain;padding:0 1em 0 0}.mw-parser-output .cs1-code{color:inherit;background:inherit;border:none;padding:inherit}.mw-parser-output .cs1-hidden-error{display:none;color:var(--color-error,#d33)}.mw-parser-output .cs1-visible-error{color:var(--color-error,#d33)}.mw-parser-output .cs1-maint{display:none;color:#085;margin-left:0.3em}.mw-parser-output .cs1-kern-left{padding-left:0.2em}.mw-parser-output .cs1-kern-right{padding-right:0.2em}.mw-parser-output .citation .mw-selflink{font-weight:inherit}@media screen{.mw-parser-output .cs1-format{font-size:95%}html.skin-theme-clientpref-night .mw-parser-output .cs1-maint{color:#18911f}}@media screen and (prefers-color-scheme:dark){html.skin-theme-clientpref-os .mw-parser-output .cs1-maint{color:#18911f}}</style>RFC&#160;<a rel="nofollow" class="external text" href="https://www.rfc-editor.org/rfc/rfc7763">7763</a> introduced <a href="/wiki/MIME" title="MIME">MIME</a> type <small><code class="mw-highlight mw-highlight-lang-text mw-content-ltr" style="" dir="ltr">text/markdown</code></small>.</li>
<li><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" />RFC&#160;<a rel="nofollow" class="external text" href="https://www.rfc-editor.org/rfc/rfc7764">7764</a> discussed and registered the variants <a href="/wiki/MultiMarkdown" title="MultiMarkdown">MultiMarkdown</a>, GitHub Flavored Markdown (GFM), <a href="/wiki/Pandoc" title="Pandoc">Pandoc</a>, and Markdown Extra among others.<sup id="cite_ref-IANA_31-0" class="reference"><a href="#cite_note-IANA-31"><span class="cite-bracket">&#91;</span>30<span class="cite-bracket">&#93;</span></a></sup></li></ul>
<div class="mw-heading mw-heading2"><h2 id="Variants">Variants</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=4" title="Edit section: Variants"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>Websites like <a href="/wiki/Bitbucket" title="Bitbucket">Bitbucket</a>, <a href="/wiki/Diaspora_(social_network)" title="Diaspora (social network)">Diaspora</a>, <a href="/wiki/Discord" title="Discord">Discord</a>,<sup id="cite_ref-32" class="reference"><a href="#cite_note-32"><span class="cite-bracket">&#91;</span>31<span class="cite-bracket">&#93;</span></a></sup> <a href="/wiki/GitHub" title="GitHub">GitHub</a>,<sup id="cite_ref-gfm_on_github_33-0" class="reference"><a href="#cite_note-gfm_on_github-33"><span class="cite-bracket">&#91;</span>32<span class="cite-bracket">&#93;</span></a></sup> <a href="/wiki/OpenStreetMap" title="OpenStreetMap">OpenStreetMap</a>, <a href="/wiki/Reddit" title="Reddit">Reddit</a>,<sup id="cite_ref-34" class="reference"><a href="#cite_note-34"><span class="cite-bracket">&#91;</span>33<span class="cite-bracket">&#93;</span></a></sup> <a href="/wiki/SourceForge" title="SourceForge">SourceForge</a><sup id="cite_ref-35" class="reference"><a href="#cite_note-35"><span class="cite-bracket">&#91;</span>34<span class="cite-bracket">&#93;</span></a></sup> and <a href="/wiki/Stack_Exchange" title="Stack Exchange">Stack Exchange</a><sup id="cite_ref-36" class="reference"><a href="#cite_note-36"><span class="cite-bracket">&#91;</span>35<span class="cite-bracket">&#93;</span></a></sup> use variants of Markdown to make discussions between users easier.
</p><p>Depending on implementation, basic inline <a href="/wiki/HTML_tag" class="mw-redirect" title="HTML tag">HTML tags</a> may be supported.<sup id="cite_ref-37" class="reference"><a href="#cite_note-37"><span class="cite-bracket">&#91;</span>36<span class="cite-bracket">&#93;</span></a></sup>
</p><p>Italic text may be implemented by <code>_underscores_</code> or <code>*single-asterisks*</code>.<sup id="cite_ref-italic_38-0" class="reference"><a href="#cite_note-italic-38"><span class="cite-bracket">&#91;</span>37<span class="cite-bracket">&#93;</span></a></sup>
</p>
<div class="mw-heading mw-heading3"><h3 id="GitHub_Flavored_Markdown">GitHub Flavored Markdown</h3><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=5" title="Edit section: GitHub Flavored Markdown"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>GitHub had been using its own variant of Markdown since as early as 2009,<sup id="cite_ref-39" class="reference"><a href="#cite_note-39"><span class="cite-bracket">&#91;</span>38<span class="cite-bracket">&#93;</span></a></sup> which added support for additional formatting such as tables and nesting <a href="/wiki/HTML_element#Block_elements" title="HTML element">block content</a> inside list elements, as well as GitHub-specific features such as auto-linking references to commits, issues, usernames, etc.
</p><p>In 2017, GitHub released a formal specification of its GitHub Flavored Markdown (GFM) that is based on CommonMark.<sup id="cite_ref-gfm_on_github_33-1" class="reference"><a href="#cite_note-gfm_on_github-33"><span class="cite-bracket">&#91;</span>32<span class="cite-bracket">&#93;</span></a></sup> It is a <a href="/wiki/Superset" class="mw-redirect" title="Superset">strict superset</a> of CommonMark, following its specification exactly except for tables, <a href="/wiki/Strikethrough" title="Strikethrough">strikethrough</a>, <a href="/wiki/Automatic_hyperlinking" title="Automatic hyperlinking">autolinks</a> and task lists, which GFM adds as extensions.<sup id="cite_ref-40" class="reference"><a href="#cite_note-40"><span class="cite-bracket">&#91;</span>39<span class="cite-bracket">&#93;</span></a></sup>
</p><p>Accordingly, GitHub also changed the parser used on their sites, which required that some documents be changed. For instance, GFM now requires that the <a href="/wiki/Number_sign" title="Number sign">hash symbol</a> that creates a heading be separated from the heading text by a space character.
</p>
<div class="mw-heading mw-heading3"><h3 id="Markdown_Extra">Markdown Extra</h3><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=6" title="Edit section: Markdown Extra"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>Markdown Extra is a <a href="/wiki/Lightweight_markup_language" title="Lightweight markup language">lightweight markup language</a> based on Markdown implemented in <a href="/wiki/PHP" title="PHP">PHP</a> (originally), <a href="/wiki/Python_(programming_language)" title="Python (programming language)">Python</a> and <a href="/wiki/Ruby_(programming_language)" title="Ruby (programming language)">Ruby</a>.<sup id="cite_ref-fortin-2018_41-0" class="reference"><a href="#cite_note-fortin-2018-41"><span class="cite-bracket">&#91;</span>40<span class="cite-bracket">&#93;</span></a></sup> It adds the following features that are not available with regular Markdown:
</p>
<ul><li>Markdown markup inside <a href="/wiki/HTML" title="HTML">HTML</a> blocks</li>
<li>Elements with id/class attribute</li>
<li>"Fenced code blocks" that span multiple lines of code</li>
<li>Tables<sup id="cite_ref-42" class="reference"><a href="#cite_note-42"><span class="cite-bracket">&#91;</span>41<span class="cite-bracket">&#93;</span></a></sup></li>
<li>Definition lists</li>
<li>Footnotes</li>
<li>Abbreviations</li></ul>
<p>Markdown Extra is supported in some <a href="/wiki/Content_management_system" title="Content management system">content management systems</a> such as <a href="/wiki/Drupal" title="Drupal">Drupal</a>,<sup id="cite_ref-43" class="reference"><a href="#cite_note-43"><span class="cite-bracket">&#91;</span>42<span class="cite-bracket">&#93;</span></a></sup> <a href="/wiki/Grav_(CMS)" title="Grav (CMS)">Grav (CMS)</a> and <a href="/wiki/TYPO3" title="TYPO3">TYPO3</a>.<sup id="cite_ref-44" class="reference"><a href="#cite_note-44"><span class="cite-bracket">&#91;</span>43<span class="cite-bracket">&#93;</span></a></sup>
</p>
<div class="mw-heading mw-heading2"><h2 id="Examples">Examples</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=7" title="Edit section: Examples"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<table class="wikitable">
<tbody><tr>
<th width="33%">Text using Markdown syntax
</th>
<th width="34%">Corresponding HTML produced by a Markdown processor
</th>
<th width="33%">Text viewed in a browser
</th></tr>
<tr valign="top">
<td>
<div class="mw-highlight mw-highlight-lang-md mw-content-ltr" dir="ltr"><pre><span></span><span class="gh">Heading</span>
<span class="gh">=======</span>

<span class="gu">Sub-heading</span>
<span class="gu">-----------</span>

<span class="gh"># Alternative heading</span>

<span class="gu">## Alternative sub-heading</span>

Paragraphs are separated
by a blank line.

Two spaces at the end of a line
produce a line break.
</pre></div>
</td>
<td>
<div class="mw-highlight mw-highlight-lang-html mw-content-ltr" dir="ltr"><pre><span></span><span class="p">&lt;</span><span class="nt">h1</span><span class="p">&gt;</span>Heading<span class="p">&lt;/</span><span class="nt">h1</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">h2</span><span class="p">&gt;</span>Sub-heading<span class="p">&lt;/</span><span class="nt">h2</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">h1</span><span class="p">&gt;</span>Alternative heading<span class="p">&lt;/</span><span class="nt">h1</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">h2</span><span class="p">&gt;</span>Alternative sub-heading<span class="p">&lt;/</span><span class="nt">h2</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Paragraphs are separated
by a blank line.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Two spaces at the end of a line<span class="p">&lt;</span><span class="nt">br</span> <span class="p">/&gt;</span>
produce a line break.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>
</pre></div>
</td>
<td><div style="overflow: hidden; page-break-after: avoid; font-size: 1.8em; font-family: Georgia,Times,serif; margin-top: 1em; margin-bottom: 0.25em; line-height: 1.3; padding: 0; border-bottom: 1px solid #AAAAAA;">Heading</div>
<div style="overflow: hidden; page-break-after: avoid; font-size: 1.5em; font-family: Georgia,Times,serif; margin-top: 1em; margin-bottom: 0.25em; line-height: 1.3; padding: 0; border-bottom: 1px solid #AAAAAA;">Sub-heading</div>
<div style="overflow: hidden; page-break-after: avoid; font-size: 1.8em; font-family: Georgia,Times,serif; margin-top: 1em; margin-bottom: 0.25em; line-height: 1.3; padding: 0; border-bottom: 1px solid #AAAAAA;">Alternative heading</div>
<div style="overflow: hidden; page-break-after: avoid; font-size: 1.5em; font-family: Georgia,Times,serif; margin-top: 1em; margin-bottom: 0.25em; line-height: 1.3; padding: 0; border-bottom: 1px solid #AAAAAA;">Alternative sub-heading</div>
<p>Paragraphs are separated
by a blank line.
</p><p>Two spaces at the end of a line<br />
produce a line break.
</p>
</td></tr>
<tr>
<td><div class="mw-highlight mw-highlight-lang-md mw-content-ltr" dir="ltr"><pre><span></span>Text attributes <span class="ge">_italic_</span>, <span class="gs">**bold**</span>, <span class="sb">\`monospace\`</span>.

Horizontal rule:

---
</pre></div>
</td>
<td>
<div class="mw-highlight mw-highlight-lang-html mw-content-ltr" dir="ltr"><pre><span></span><span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Text attributes <span class="p">&lt;</span><span class="nt">em</span><span class="p">&gt;</span>italic<span class="p">&lt;/</span><span class="nt">em</span><span class="p">&gt;</span>, <span class="p">&lt;</span><span class="nt">strong</span><span class="p">&gt;</span>bold<span class="p">&lt;/</span><span class="nt">strong</span><span class="p">&gt;</span>, <span class="p">&lt;</span><span class="nt">code</span><span class="p">&gt;</span>monospace<span class="p">&lt;/</span><span class="nt">code</span><span class="p">&gt;</span>.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Horizontal rule:<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">hr</span> <span class="p">/&gt;</span>
</pre></div>
</td>
<td>Text attributes <i>italic</i>, <b>bold</b>, <code>monospace</code>.<p class="mw-empty-elt"></p>
<p>Horizontal rule:
</p>
<hr />
</td></tr>
<tr>
<td><div class="mw-highlight mw-highlight-lang-md mw-content-ltr" dir="ltr"><pre><span></span>Bullet lists nested within numbered list:

<span class="w">  </span><span class="k">1.</span> fruits
<span class="w">     </span><span class="k">*</span><span class="w"> </span>apple
<span class="w">     </span><span class="k">*</span><span class="w"> </span>banana
<span class="w">  </span><span class="k">2.</span> vegetables
<span class="w">     </span><span class="k">-</span><span class="w"> </span>carrot
<span class="w">     </span><span class="k">-</span><span class="w"> </span>broccoli
</pre></div>
</td>
<td>
<div class="mw-highlight mw-highlight-lang-html mw-content-ltr" dir="ltr"><pre><span></span><span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Bullet lists nested within numbered list:<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">ol</span><span class="p">&gt;</span>
  <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>fruits <span class="p">&lt;</span><span class="nt">ul</span><span class="p">&gt;</span>
      <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>apple<span class="p">&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
      <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>banana<span class="p">&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
  <span class="p">&lt;/</span><span class="nt">ul</span><span class="p">&gt;&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
  <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>vegetables <span class="p">&lt;</span><span class="nt">ul</span><span class="p">&gt;</span>
      <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>carrot<span class="p">&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
      <span class="p">&lt;</span><span class="nt">li</span><span class="p">&gt;</span>broccoli<span class="p">&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
  <span class="p">&lt;/</span><span class="nt">ul</span><span class="p">&gt;&lt;/</span><span class="nt">li</span><span class="p">&gt;</span>
<span class="p">&lt;/</span><span class="nt">ol</span><span class="p">&gt;</span>
</pre></div>
</td>
<td>Bullet lists nested within numbered list:
<ol><li>fruits
<ul><li>apple</li>
<li>banana</li></ul></li>
<li>vegetables
<ul><li>carrot</li>
<li>broccoli</li></ul></li></ol>
</td></tr>
<tr>
<td><div class="mw-highlight mw-highlight-lang-md mw-content-ltr" dir="ltr"><pre><span></span>A [<span class="nt">link</span>](<span class="na">http://example.com</span>).

![<span class="nt">Image</span>](<span class="na">Icon-pictures.png &quot;icon&quot;</span>)

<span class="k">&gt; </span><span class="ge">Markdown uses email-style</span>
characters for blockquoting.
<span class="k">&gt;</span>
<span class="ge">&gt; Multiple paragraphs need to be prepended individually.</span>

Most inline &lt;abbr title=&quot;Hypertext Markup Language&quot;&gt;HTML&lt;/abbr&gt; tags are supported.
</pre></div>
</td>
<td>
<div class="mw-highlight mw-highlight-lang-html mw-content-ltr" dir="ltr"><pre><span></span><span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>A <span class="p">&lt;</span><span class="nt">a</span> <span class="na">href</span><span class="o">=</span><span class="s">&quot;http://example.com&quot;</span><span class="p">&gt;</span>link<span class="p">&lt;/</span><span class="nt">a</span><span class="p">&gt;</span>.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;&lt;</span><span class="nt">img</span> <span class="na">alt</span><span class="o">=</span><span class="s">&quot;Image&quot;</span> <span class="na">title</span><span class="o">=</span><span class="s">&quot;icon&quot;</span> <span class="na">src</span><span class="o">=</span><span class="s">&quot;Icon-pictures.png&quot;</span> <span class="p">/&gt;&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>

{{blockquote|
<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Markdown uses email-style characters for blockquoting.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>
<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Multiple paragraphs need to be prepended individually.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>
}}

<span class="p">&lt;</span><span class="nt">p</span><span class="p">&gt;</span>Most inline <span class="p">&lt;</span><span class="nt">abbr</span> <span class="na">title</span><span class="o">=</span><span class="s">&quot;Hypertext Markup Language&quot;</span><span class="p">&gt;</span>HTML<span class="p">&lt;/</span><span class="nt">abbr</span><span class="p">&gt;</span> tags are supported.<span class="p">&lt;/</span><span class="nt">p</span><span class="p">&gt;</span>
</pre></div>
</td>
<td>A <a rel="nofollow" class="external text" href="http://example.com/">link</a>.
<p><span class="mw-default-size" typeof="mw:File"><span title="icon"><img alt="Image" src="//upload.wikimedia.org/wikipedia/commons/5/5c/Icon-pictures.png" decoding="async" width="65" height="59" class="mw-file-element" data-file-width="65" data-file-height="59" /></span></span>
</p>
<style data-mw-deduplicate="TemplateStyles:r1244412712">.mw-parser-output .templatequote{overflow:hidden;margin:1em 0;padding:0 32px}.mw-parser-output .templatequotecite{line-height:1.5em;text-align:left;margin-top:0}@media(min-width:500px){.mw-parser-output .templatequotecite{padding-left:1.6em}}</style><blockquote class="templatequote">
<p>Markdown uses email-style characters for blockquoting.
</p><p>Multiple paragraphs need to be prepended individually.
</p>
</blockquote>
<p>Most inline <abbr title="Hypertext Markup Language">HTML</abbr> tags are supported.
</p>
</td></tr></tbody></table>
<div class="mw-heading mw-heading2"><h2 id="Implementations">Implementations</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=8" title="Edit section: Implementations"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<p>Implementations of Markdown are available for over a dozen <a href="/wiki/Programming_language" title="Programming language">programming languages</a>; in addition, many <a href="/wiki/Application_software" title="Application software">applications</a>, platforms and <a href="/wiki/Software_framework" title="Software framework">frameworks</a> support Markdown.<sup id="cite_ref-45" class="reference"><a href="#cite_note-45"><span class="cite-bracket">&#91;</span>44<span class="cite-bracket">&#93;</span></a></sup> For example, Markdown <a href="/wiki/Plug-in_(computing)" title="Plug-in (computing)">plugins</a> exist for every major <a href="/wiki/Blog" title="Blog">blogging</a> platform.<sup id="cite_ref-ArsTechnica2014_12-2" class="reference"><a href="#cite_note-ArsTechnica2014-12"><span class="cite-bracket">&#91;</span>12<span class="cite-bracket">&#93;</span></a></sup>
</p><p>While Markdown is a minimal markup language and is read and edited with a normal <a href="/wiki/Text_editor" title="Text editor">text editor</a>, there are specially designed editors that preview the files with styles, which are available for all major platforms. Many general-purpose text and <a href="/wiki/Source-code_editor" title="Source-code editor">code editors</a> have <a href="/wiki/Syntax_highlighting" title="Syntax highlighting">syntax highlighting</a> plugins for Markdown built into them or available as optional download. Editors may feature a side-by-side preview window or render the code directly in a <a href="/wiki/WYSIWYG" title="WYSIWYG">WYSIWYG</a> fashion.
</p>
<div class="mw-heading mw-heading2"><h2 id="See_also">See also</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=9" title="Edit section: See also"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<ul><li><a href="/wiki/Comparison_of_document_markup_languages" title="Comparison of document markup languages">Comparison of document markup languages</a></li>
<li><a href="/wiki/Comparison_of_documentation_generators" title="Comparison of documentation generators">Comparison of documentation generators</a></li>
<li><a href="/wiki/Lightweight_markup_language" title="Lightweight markup language">Lightweight markup language</a></li>
<li><a href="/wiki/Wiki_markup" class="mw-redirect" title="Wiki markup">Wiki markup</a></li></ul>
<div class="mw-heading mw-heading2"><h2 id="Explanatory_notes">Explanatory notes</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=10" title="Edit section: Explanatory notes"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<style data-mw-deduplicate="TemplateStyles:r1239543626">.mw-parser-output .reflist{margin-bottom:0.5em;list-style-type:decimal}@media screen{.mw-parser-output .reflist{font-size:90%}}.mw-parser-output .reflist .references{font-size:100%;margin-bottom:0;list-style-type:inherit}.mw-parser-output .reflist-columns-2{column-width:30em}.mw-parser-output .reflist-columns-3{column-width:25em}.mw-parser-output .reflist-columns{margin-top:0.3em}.mw-parser-output .reflist-columns ol{margin-top:0}.mw-parser-output .reflist-columns li{page-break-inside:avoid;break-inside:avoid-column}.mw-parser-output .reflist-upper-alpha{list-style-type:upper-alpha}.mw-parser-output .reflist-upper-roman{list-style-type:upper-roman}.mw-parser-output .reflist-lower-alpha{list-style-type:lower-alpha}.mw-parser-output .reflist-lower-greek{list-style-type:lower-greek}.mw-parser-output .reflist-lower-roman{list-style-type:lower-roman}</style><div class="reflist">
<div class="mw-references-wrap"><ol class="references">
<li id="cite_note-16"><span class="mw-cite-backlink"><b><a href="#cite_ref-16">^</a></b></span> <span class="reference-text">Technically HTML description lists</span>
</li>
</ol></div></div>
<div class="mw-heading mw-heading2"><h2 id="References">References</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=11" title="Edit section: References"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1239543626" /><div class="reflist reflist-columns references-column-width" style="column-width: 30em;">
<ol class="references">
<li id="cite_note-df-2022-1"><span class="mw-cite-backlink"><b><a href="#cite_ref-df-2022_1-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFGruber,_John2014" class="citation web cs1">Gruber, John (8 January 2014). <a rel="nofollow" class="external text" href="https://daringfireball.net/linked/2014/01/08/markdown-extension">"The Markdown File Extension"</a>. The Daring Fireball Company, LLC. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200712120733/https://daringfireball.net/linked/2014/01/08/markdown-extension">Archived</a> from the original on 12 July 2020<span class="reference-accessdate">. Retrieved <span class="nowrap">27 March</span> 2022</span>. <q>Too late now, I suppose, but the only file extension I would endorse is ".markdown", for the same reason offered by Hilton Lipschitz: <i>We no longer live in a 8.3 world, so we should be using the most descriptive file extensions. It's sad that all our operating systems rely on this stupid convention instead of the better creator code or a metadata model, but great that they now support longer file extensions.</i></q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=The+Markdown+File+Extension&amp;rft.pub=The+Daring+Fireball+Company%2C+LLC&amp;rft.date=2014-01-08&amp;rft.au=Gruber%2C+John&amp;rft_id=https%3A%2F%2Fdaringfireball.net%2Flinked%2F2014%2F01%2F08%2Fmarkdown-extension&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-rfc7763-2"><span class="mw-cite-backlink">^ <a href="#cite_ref-rfc7763_2-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-rfc7763_2-1"><sup><i><b>b</b></i></sup></a> <a href="#cite_ref-rfc7763_2-2"><sup><i><b>c</b></i></sup></a></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFLeonard,_Sean2016" class="citation journal cs1">Leonard, Sean (March 2016). <a rel="nofollow" class="external text" href="https://datatracker.ietf.org/doc/html/rfc7763">"The text/markdown Media Type"</a>. <i>Request for Comments: 7763</i>. Internet Engineering Task Force. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20220322001232/https://datatracker.ietf.org/doc/html/rfc7763">Archived</a> from the original on 22 March 2022<span class="reference-accessdate">. Retrieved <span class="nowrap">27 March</span> 2022</span>. <q>This document registers the text/markdown media type for use with Markdown, a family of plain-text formatting syntaxes that optionally can be converted to formal markup languages such as HTML.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=article&amp;rft.jtitle=Request+for+Comments%3A+7763&amp;rft.atitle=The+text%2Fmarkdown+Media+Type&amp;rft.date=2016-03&amp;rft.au=Leonard%2C+Sean&amp;rft_id=https%3A%2F%2Fdatatracker.ietf.org%2Fdoc%2Fhtml%2Frfc7763&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-markdown-swartz-3"><span class="mw-cite-backlink"><b><a href="#cite_ref-markdown-swartz_3-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFSwartz2004" class="citation web cs1"><a href="/wiki/Aaron_Swartz" title="Aaron Swartz">Swartz, Aaron</a> (2004-03-19). <a rel="nofollow" class="external text" href="http://www.aaronsw.com/weblog/001189">"Markdown"</a>. <i>Aaron Swartz: The Weblog</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20171224200232/http://www.aaronsw.com/weblog/001189">Archived</a> from the original on 2017-12-24<span class="reference-accessdate">. Retrieved <span class="nowrap">2013-09-01</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Aaron+Swartz%3A+The+Weblog&amp;rft.atitle=Markdown&amp;rft.date=2004-03-19&amp;rft.aulast=Swartz&amp;rft.aufirst=Aaron&amp;rft_id=http%3A%2F%2Fwww.aaronsw.com%2Fweblog%2F001189&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-gruber-2004-release-4"><span class="mw-cite-backlink"><b><a href="#cite_ref-gruber-2004-release_4-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFGruber" class="citation web cs1"><a href="/wiki/John_Gruber" title="John Gruber">Gruber, John</a>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20040311230924/https://daringfireball.net/projects/markdown/index.text">"Markdown"</a>. <i><a href="/wiki/Daring_Fireball" class="mw-redirect" title="Daring Fireball">Daring Fireball</a></i>. Archived from <a rel="nofollow" class="external text" href="http://daringfireball.net/projects/markdown/index.text">the original</a> on 2004-03-11<span class="reference-accessdate">. Retrieved <span class="nowrap">2022-08-20</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Daring+Fireball&amp;rft.atitle=Markdown&amp;rft.aulast=Gruber&amp;rft.aufirst=John&amp;rft_id=http%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2Findex.text&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-md-5"><span class="mw-cite-backlink">^ <a href="#cite_ref-md_5-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-md_5-1"><sup><i><b>b</b></i></sup></a> <a href="#cite_ref-md_5-2"><sup><i><b>c</b></i></sup></a></span> <span class="reference-text">Markdown 1.0.1 readme source code <link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://web.archive.org/web/20040402182332/http://daringfireball.net/projects/markdown/">"Daring Fireball – Markdown"</a>. 2004-12-17. Archived from <a rel="nofollow" class="external text" href="http://daringfireball.net/projects/markdown/">the original</a> on 2004-04-02.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Daring+Fireball+%E2%80%93+Markdown&amp;rft.date=2004-12-17&amp;rft_id=http%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-license-6"><span class="mw-cite-backlink"><b><a href="#cite_ref-license_6-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://daringfireball.net/projects/markdown/license">"Markdown: License"</a>. Daring Fireball. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200218183533/https://daringfireball.net/projects/markdown/license">Archived</a> from the original on 2020-02-18<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-25</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown%3A+License&amp;rft.pub=Daring+Fireball&amp;rft_id=http%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2Flicense&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-rfc7764-7"><span class="mw-cite-backlink">^ <a href="#cite_ref-rfc7764_7-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-rfc7764_7-1"><sup><i><b>b</b></i></sup></a></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFLeonard,_Sean2016" class="citation journal cs1">Leonard, Sean (March 2016). <a rel="nofollow" class="external text" href="https://datatracker.ietf.org/doc/html/rfc7764">"Guidance on Markdown: Design Philosophies, Stability Strategies, and Select Registrations"</a>. <i>Request for Comments: 7764</i>. Internet Engineering Task Force. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20220417115136/https://datatracker.ietf.org/doc/html/rfc7764">Archived</a> from the original on 17 April 2022<span class="reference-accessdate">. Retrieved <span class="nowrap">27 March</span> 2022</span>. <q>This document elaborates upon the text/markdown media type for use with Markdown, a family of plain-text formatting syntaxes that optionally can be converted to formal markup languages such as HTML. Background information, local storage strategies, and additional syntax registrations are supplied.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=article&amp;rft.jtitle=Request+for+Comments%3A+7764&amp;rft.atitle=Guidance+on+Markdown%3A+Design+Philosophies%2C+Stability+Strategies%2C+and+Select+Registrations&amp;rft.date=2016-03&amp;rft.au=Leonard%2C+Sean&amp;rft_id=https%3A%2F%2Fdatatracker.ietf.org%2Fdoc%2Fhtml%2Frfc7764&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-RMarkdown-8"><span class="mw-cite-backlink"><b><a href="#cite_ref-RMarkdown_8-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://rmarkdown.rstudio.com/">"RMarkdown Reference site"</a>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200303054734/https://rmarkdown.rstudio.com/">Archived</a> from the original on 2020-03-03<span class="reference-accessdate">. Retrieved <span class="nowrap">2019-11-21</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=RMarkdown+Reference+site&amp;rft_id=https%3A%2F%2Frmarkdown.rstudio.com%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-philosophy-9"><span class="mw-cite-backlink">^ <a href="#cite_ref-philosophy_9-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-philosophy_9-1"><sup><i><b>b</b></i></sup></a> <a href="#cite_ref-philosophy_9-2"><sup><i><b>c</b></i></sup></a> <a href="#cite_ref-philosophy_9-3"><sup><i><b>d</b></i></sup></a></span> <span class="reference-text">Markdown Syntax <link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://daringfireball.net/projects/markdown/syntax#philosophy">"Daring Fireball – Markdown – Syntax"</a>. 2013-06-13.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Daring+Fireball+%E2%80%93+Markdown+%E2%80%93+Syntax&amp;rft.date=2013-06-13&amp;rft_id=http%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2Fsyntax%23philosophy&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span> "Readability, however, is emphasized above all else. A Markdown-formatted document should be publishable as-is, as plain text, without looking like it's been marked up with tags or formatting instructions. While Markdown's syntax has been influenced by several existing text-to-HTML filters — including Setext, atx, Textile, reStructuredText, Grutatext<sup id="cite_ref-grutatext_14-0" class="reference"><a href="#cite_note-grutatext-14"><span class="cite-bracket">&#91;</span>14<span class="cite-bracket">&#93;</span></a></sup>, and EtText<sup id="cite_ref-ettext_15-0" class="reference"><a href="#cite_note-ettext-15"><span class="cite-bracket">&#91;</span>15<span class="cite-bracket">&#93;</span></a></sup> — the single biggest source of inspiration for Markdown's syntax is the format of plain text email."</span>
</li>
<li id="cite_note-10"><span class="mw-cite-backlink"><b><a href="#cite_ref-10">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://daringfireball.net/2004/03/introducing_markdown">"Daring Fireball: Introducing Markdown"</a>. <i>daringfireball.net</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200920182442/https://daringfireball.net/2004/03/introducing_markdown">Archived</a> from the original on 2020-09-20<span class="reference-accessdate">. Retrieved <span class="nowrap">2020-09-23</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=daringfireball.net&amp;rft.atitle=Daring+Fireball%3A+Introducing+Markdown&amp;rft_id=https%3A%2F%2Fdaringfireball.net%2F2004%2F03%2Fintroducing_markdown&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-FutureOfMarkdown-11"><span class="mw-cite-backlink">^ <a href="#cite_ref-FutureOfMarkdown_11-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-FutureOfMarkdown_11-1"><sup><i><b>b</b></i></sup></a></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFAtwood2012" class="citation web cs1">Atwood, Jeff (2012-10-25). <a rel="nofollow" class="external text" href="https://web.archive.org/web/20140211233513/http://www.codinghorror.com/blog/2012/10/the-future-of-markdown.html">"The Future of Markdown"</a>. CodingHorror.com. Archived from <a rel="nofollow" class="external text" href="http://www.codinghorror.com/blog/2012/10/the-future-of-markdown.html">the original</a> on 2014-02-11<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-25</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=The+Future+of+Markdown&amp;rft.pub=CodingHorror.com&amp;rft.date=2012-10-25&amp;rft.aulast=Atwood&amp;rft.aufirst=Jeff&amp;rft_id=http%3A%2F%2Fwww.codinghorror.com%2Fblog%2F2012%2F10%2Fthe-future-of-markdown.html&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-ArsTechnica2014-12"><span class="mw-cite-backlink">^ <a href="#cite_ref-ArsTechnica2014_12-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-ArsTechnica2014_12-1"><sup><i><b>b</b></i></sup></a> <a href="#cite_ref-ArsTechnica2014_12-2"><sup><i><b>c</b></i></sup></a></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFGilbertson2014" class="citation news cs1">Gilbertson, Scott (October 5, 2014). <a rel="nofollow" class="external text" href="https://arstechnica.com/information-technology/2014/10/markdown-throwdown-what-happens-when-foss-software-gets-corporate-backing/">"Markdown throwdown: What happens when FOSS software gets corporate backing?"</a>. <i><a href="/wiki/Ars_Technica" title="Ars Technica">Ars Technica</a></i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20201114231130/https://arstechnica.com/information-technology/2014/10/markdown-throwdown-what-happens-when-foss-software-gets-corporate-backing/">Archived</a> from the original on November 14, 2020<span class="reference-accessdate">. Retrieved <span class="nowrap">June 14,</span> 2017</span>. <q><a href="/wiki/CommonMark" class="mw-redirect" title="CommonMark">CommonMark</a> fork could end up better for users... but original creators seem to disagree.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=article&amp;rft.jtitle=Ars+Technica&amp;rft.atitle=Markdown+throwdown%3A+What+happens+when+FOSS+software+gets+corporate+backing%3F&amp;rft.date=2014-10-05&amp;rft.aulast=Gilbertson&amp;rft.aufirst=Scott&amp;rft_id=https%3A%2F%2Farstechnica.com%2Finformation-technology%2F2014%2F10%2Fmarkdown-throwdown-what-happens-when-foss-software-gets-corporate-backing%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-Gruber-13"><span class="mw-cite-backlink"><b><a href="#cite_ref-Gruber_13-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFgruber2016" class="citation web cs1">@gruber (June 12, 2016). <a rel="nofollow" class="external text" href="https://x.com/gruber/status/741989829173510145">"I should write about it, but it's painful. More or less: Aaron was my sounding board, my muse"</a> (<a href="/wiki/Tweet_(social_media)" title="Tweet (social media)">Tweet</a>) &#8211; via <a href="/wiki/Twitter" title="Twitter">Twitter</a>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=I+should+write+about+it%2C+but+it%27s+painful.+More+or+less%3A+Aaron+was+my+sounding+board%2C+my+muse.&amp;rft.date=2016-06-12&amp;rft.au=gruber&amp;rft_id=https%3A%2F%2Fx.com%2Fgruber%2Fstatus%2F741989829173510145&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-grutatext-14"><span class="mw-cite-backlink"><b><a href="#cite_ref-grutatext_14-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://triptico.com/docs/grutatxt_markup.html">"Un naufragio personal: The Grutatxt markup"</a>. <i>triptico.com</i><span class="reference-accessdate">. Retrieved <span class="nowrap">2022-06-30</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=triptico.com&amp;rft.atitle=Un+naufragio+personal%3A+The+Grutatxt+markup&amp;rft_id=https%3A%2F%2Ftriptico.com%2Fdocs%2Fgrutatxt_markup.html&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-ettext-15"><span class="mw-cite-backlink"><b><a href="#cite_ref-ettext_15-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://ettext.taint.org/doc/ettext.html">"EtText: Documentation: Using EtText"</a>. <i>ettext.taint.org</i><span class="reference-accessdate">. Retrieved <span class="nowrap">2022-06-30</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=ettext.taint.org&amp;rft.atitle=EtText%3A+Documentation%3A+Using+EtText&amp;rft_id=http%3A%2F%2Fettext.taint.org%2Fdoc%2Fettext.html&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-17"><span class="mw-cite-backlink"><b><a href="#cite_ref-17">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://daringfireball.net/projects/markdown/syntax">"Markdown Syntax Documentation"</a>. Daring Fireball. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20190909051956/https://daringfireball.net/projects/markdown/syntax">Archived</a> from the original on 2019-09-09<span class="reference-accessdate">. Retrieved <span class="nowrap">2018-03-09</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown+Syntax+Documentation&amp;rft.pub=Daring+Fireball&amp;rft_id=https%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2Fsyntax&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-gfm_on_github-why_spec-18"><span class="mw-cite-backlink"><b><a href="#cite_ref-gfm_on_github-why_spec_18-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://github.github.com/gfm/#why-is-a-spec-needed-">"GitHub Flavored Markdown Spec – Why is a spec needed?"</a>. <i>github.github.com</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200203204734/https://github.github.com/gfm/#why-is-a-spec-needed-">Archived</a> from the original on 2020-02-03<span class="reference-accessdate">. Retrieved <span class="nowrap">2018-05-17</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=github.github.com&amp;rft.atitle=GitHub+Flavored+Markdown+Spec+%E2%80%93+Why+is+a+spec+needed%3F&amp;rft_id=https%3A%2F%2Fgithub.github.com%2Fgfm%2F%23why-is-a-spec-needed-&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-babelmark-2-19"><span class="mw-cite-backlink"><b><a href="#cite_ref-babelmark-2_19-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://johnmacfarlane.net/babelmark2/">"Babelmark 2 – Compare markdown implementations"</a>. Johnmacfarlane.net. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20170718113552/http://johnmacfarlane.net/babelmark2/">Archived</a> from the original on 2017-07-18<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-25</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Babelmark+2+%E2%80%93+Compare+markdown+implementations&amp;rft.pub=Johnmacfarlane.net&amp;rft_id=http%3A%2F%2Fjohnmacfarlane.net%2Fbabelmark2%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-babelmark-3-20"><span class="mw-cite-backlink"><b><a href="#cite_ref-babelmark-3_20-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://babelmark.github.io/">"Babelmark 3 – Compare Markdown Implementations"</a>. github.io. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20201112043521/https://babelmark.github.io/">Archived</a> from the original on 2020-11-12<span class="reference-accessdate">. Retrieved <span class="nowrap">2017-12-10</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Babelmark+3+%E2%80%93+Compare+Markdown+Implementations&amp;rft.pub=github.io&amp;rft_id=https%3A%2F%2Fbabelmark.github.io%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-21"><span class="mw-cite-backlink"><b><a href="#cite_ref-21">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://johnmacfarlane.net/babelmark2/faq.html">"Babelmark 2 – FAQ"</a>. Johnmacfarlane.net. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20170728115918/http://johnmacfarlane.net/babelmark2/faq.html">Archived</a> from the original on 2017-07-28<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-25</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Babelmark+2+%E2%80%93+FAQ&amp;rft.pub=Johnmacfarlane.net&amp;rft_id=http%3A%2F%2Fjohnmacfarlane.net%2Fbabelmark2%2Ffaq.html&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-22"><span class="mw-cite-backlink"><b><a href="#cite_ref-22">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFGruber2014" class="citation web cs1"><a href="/wiki/John_Gruber" title="John Gruber">Gruber, John [@gruber]</a> (4 September 2014). <a rel="nofollow" class="external text" href="https://x.com/gruber/status/507670720886091776">"@tobie @espadrine @comex @wycats Because different sites (and people) have different needs. No one syntax would make all happy"</a> (<a href="/wiki/Tweet_(social_media)" title="Tweet (social media)">Tweet</a>) &#8211; via <a href="/wiki/Twitter" title="Twitter">Twitter</a>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=%40tobie+%40espadrine+%40comex+%40wycats+Because+different+sites+%28and+people%29+have+different+needs.+No+one+syntax+would+make+all+happy.&amp;rft.date=2014-09-04&amp;rft.aulast=Gruber&amp;rft.aufirst=John&amp;rft_id=https%3A%2F%2Fx.com%2Fgruber%2Fstatus%2F507670720886091776&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-curlyBraces-23"><span class="mw-cite-backlink"><b><a href="#cite_ref-curlyBraces_23-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFGruber2022" class="citation web cs1">Gruber, John (19 May 2022). <a rel="nofollow" class="external text" href="https://daringfireball.net/linked/2022/05/19/markdoc">"Markdoc"</a>. <i>Daring Fireball</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20220519202920/https://daringfireball.net/linked/2022/05/19/markdoc">Archived</a> from the original on 19 May 2022<span class="reference-accessdate">. Retrieved <span class="nowrap">May 19,</span> 2022</span>. <q>I love their syntax extensions — very true to the spirit of Markdown. They use curly braces for their extensions; I'm not sure I ever made this clear, publicly, but I avoided using curly braces in Markdown itself — even though they are very tempting characters — to unofficially reserve them for implementation-specific extensions. Markdoc's extensive use of curly braces for its syntax is exactly the sort of thing I was thinking about.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Daring+Fireball&amp;rft.atitle=Markdoc&amp;rft.date=2022-05-19&amp;rft.aulast=Gruber&amp;rft.aufirst=John&amp;rft_id=https%3A%2F%2Fdaringfireball.net%2Flinked%2F2022%2F05%2F19%2Fmarkdoc&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-cm-uti-24"><span class="mw-cite-backlink"><b><a href="#cite_ref-cm-uti_24-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://talk.commonmark.org/t/uti-of-a-commonmark-document/2406">"UTI of a CommonMark document"</a>. 12 April 2017. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20181122140119/https://talk.commonmark.org/t/uti-of-a-commonmark-document/2406">Archived</a> from the original on 22 November 2018<span class="reference-accessdate">. Retrieved <span class="nowrap">29 September</span> 2017</span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=UTI+of+a+CommonMark+document&amp;rft.date=2017-04-12&amp;rft_id=https%3A%2F%2Ftalk.commonmark.org%2Ft%2Futi-of-a-commonmark-document%2F2406&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-cm-spec-25"><span class="mw-cite-backlink"><b><a href="#cite_ref-cm-spec_25-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://spec.commonmark.org/">"CommonMark specification"</a>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20170807052756/http://spec.commonmark.org/">Archived</a> from the original on 2017-08-07<span class="reference-accessdate">. Retrieved <span class="nowrap">2017-07-26</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=CommonMark+specification&amp;rft_id=http%3A%2F%2Fspec.commonmark.org%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-26"><span class="mw-cite-backlink"><b><a href="#cite_ref-26">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://markdown.github.io/">"Markdown Community Page"</a>. GitHub. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20201026161924/http://markdown.github.io/">Archived</a> from the original on 2020-10-26<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-25</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown+Community+Page&amp;rft.pub=GitHub&amp;rft_id=https%3A%2F%2Fmarkdown.github.io%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-27"><span class="mw-cite-backlink"><b><a href="#cite_ref-27">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://blog.codinghorror.com/standard-markdown-is-now-common-markdown/">"Standard Markdown is now Common Markdown"</a>. Jeff Atwood. 4 September 2014. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20141009181014/http://blog.codinghorror.com/standard-markdown-is-now-common-markdown/">Archived</a> from the original on 2014-10-09<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-10-07</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Standard+Markdown+is+now+Common+Markdown&amp;rft.pub=Jeff+Atwood&amp;rft.date=2014-09-04&amp;rft_id=http%3A%2F%2Fblog.codinghorror.com%2Fstandard-markdown-is-now-common-markdown%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-28"><span class="mw-cite-backlink"><b><a href="#cite_ref-28">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://www.infoq.com/news/2014/09/markdown-commonmark">"Standard Markdown Becomes Common Markdown then CommonMark"</a>. <i>InfoQ</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200930150521/https://www.infoq.com/news/2014/09/markdown-commonmark/">Archived</a> from the original on 2020-09-30<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-10-07</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=InfoQ&amp;rft.atitle=Standard+Markdown+Becomes+Common+Markdown+then+CommonMark&amp;rft_id=http%3A%2F%2Fwww.infoq.com%2Fnews%2F2014%2F09%2Fmarkdown-commonmark&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-commonmark.org-29"><span class="mw-cite-backlink"><b><a href="#cite_ref-commonmark.org_29-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://commonmark.org/">"CommonMark"</a>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20160412211434/http://commonmark.org/">Archived</a> from the original on 12 April 2016<span class="reference-accessdate">. Retrieved <span class="nowrap">20 Jun</span> 2018</span>. <q>The current version of the CommonMark spec is complete, and quite robust after a year of public feedback … but not quite final. With your help, we plan to announce a finalized 1.0 spec and test suite in 2019.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=CommonMark&amp;rft_id=http%3A%2F%2Fcommonmark.org%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-30"><span class="mw-cite-backlink"><b><a href="#cite_ref-30">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://talk.commonmark.org/t/issues-we-must-resolve-before-1-0-release-6-remaining/1287">"Issues we MUST resolve before 1.0 release &#91;6 remaining&#93;"</a>. <i>CommonMark Discussion</i>. 2015-07-26. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20210414032229/https://talk.commonmark.org/t/issues-we-must-resolve-before-1-0-release-6-remaining/1287">Archived</a> from the original on 2021-04-14<span class="reference-accessdate">. Retrieved <span class="nowrap">2020-10-02</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=CommonMark+Discussion&amp;rft.atitle=Issues+we+MUST+resolve+before+1.0+release+%5B6+remaining%5D&amp;rft.date=2015-07-26&amp;rft_id=https%3A%2F%2Ftalk.commonmark.org%2Ft%2Fissues-we-must-resolve-before-1-0-release-6-remaining%2F1287&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-IANA-31"><span class="mw-cite-backlink"><b><a href="#cite_ref-IANA_31-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml">"Markdown Variants"</a>. <a href="/wiki/Internet_Assigned_Numbers_Authority" title="Internet Assigned Numbers Authority">IANA</a>. 2016-03-28. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20201027005128/https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml">Archived</a> from the original on 2020-10-27<span class="reference-accessdate">. Retrieved <span class="nowrap">2016-07-06</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown+Variants&amp;rft.pub=IANA&amp;rft.date=2016-03-28&amp;rft_id=https%3A%2F%2Fwww.iana.org%2Fassignments%2Fmarkdown-variants%2Fmarkdown-variants.xhtml&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-32"><span class="mw-cite-backlink"><b><a href="#cite_ref-32">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline">"Markdown Text 101 (Chat Formatting: Bold, Italic, Underline)"</a>. <i>Discord</i>. 2024-10-03<span class="reference-accessdate">. Retrieved <span class="nowrap">2025-02-07</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Discord&amp;rft.atitle=Markdown+Text+101+%28Chat+Formatting%3A+Bold%2C+Italic%2C+Underline%29&amp;rft.date=2024-10-03&amp;rft_id=https%3A%2F%2Fsupport.discord.com%2Fhc%2Fen-us%2Farticles%2F210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-gfm_on_github-33"><span class="mw-cite-backlink">^ <a href="#cite_ref-gfm_on_github_33-0"><sup><i><b>a</b></i></sup></a> <a href="#cite_ref-gfm_on_github_33-1"><sup><i><b>b</b></i></sup></a></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://github.github.com/gfm/">"GitHub Flavored Markdown Spec"</a>. GitHub. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200203204734/https://github.github.com/gfm/">Archived</a> from the original on 2020-02-03<span class="reference-accessdate">. Retrieved <span class="nowrap">2020-06-11</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=GitHub+Flavored+Markdown+Spec&amp;rft.pub=GitHub&amp;rft_id=https%3A%2F%2Fgithub.github.com%2Fgfm%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-34"><span class="mw-cite-backlink"><b><a href="#cite_ref-34">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://www.reddit.com/r/reddit.com/comments/6ewgt/reddit_markdown_primer_or_how_do_you_do_all_that/">"Reddit markdown primer. Or, how do you do all that fancy formatting in your comments, anyway?"</a>. Reddit. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20190611185827/https://www.reddit.com/r/reddit.com/comments/6ewgt/reddit_markdown_primer_or_how_do_you_do_all_that/">Archived</a> from the original on 2019-06-11<span class="reference-accessdate">. Retrieved <span class="nowrap">2013-03-29</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Reddit+markdown+primer.+Or%2C+how+do+you+do+all+that+fancy+formatting+in+your+comments%2C+anyway%3F&amp;rft.pub=Reddit&amp;rft_id=https%3A%2F%2Fwww.reddit.com%2Fr%2Freddit.com%2Fcomments%2F6ewgt%2Freddit_markdown_primer_or_how_do_you_do_all_that%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-35"><span class="mw-cite-backlink"><b><a href="#cite_ref-35">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="http://sourceforge.net/p/forge/documentation/markdown_syntax/">"SourceForge: Markdown Syntax Guide"</a>. <a href="/wiki/SourceForge" title="SourceForge">SourceForge</a>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20190613130356/https://sourceforge.net/p/forge/documentation/markdown_syntax/">Archived</a> from the original on 2019-06-13<span class="reference-accessdate">. Retrieved <span class="nowrap">2013-05-10</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=SourceForge%3A+Markdown+Syntax+Guide&amp;rft.pub=SourceForge&amp;rft_id=http%3A%2F%2Fsourceforge.net%2Fp%2Fforge%2Fdocumentation%2Fmarkdown_syntax%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-36"><span class="mw-cite-backlink"><b><a href="#cite_ref-36">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://stackoverflow.com/editing-help">"Markdown Editing Help"</a>. StackOverflow.com. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20140328061854/http://stackoverflow.com/editing-help">Archived</a> from the original on 2014-03-28<span class="reference-accessdate">. Retrieved <span class="nowrap">2014-04-11</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown+Editing+Help&amp;rft.pub=StackOverflow.com&amp;rft_id=https%3A%2F%2Fstackoverflow.com%2Fediting-help&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-37"><span class="mw-cite-backlink"><b><a href="#cite_ref-37">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://daringfireball.net/projects/markdown/syntax#html">"Markdown Syntax Documentation"</a>. <i>daringfireball.net</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20190909051956/https://daringfireball.net/projects/markdown/syntax#html">Archived</a> from the original on 2019-09-09<span class="reference-accessdate">. Retrieved <span class="nowrap">2021-03-01</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=daringfireball.net&amp;rft.atitle=Markdown+Syntax+Documentation&amp;rft_id=https%3A%2F%2Fdaringfireball.net%2Fprojects%2Fmarkdown%2Fsyntax%23html&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-italic-38"><span class="mw-cite-backlink"><b><a href="#cite_ref-italic_38-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://www.markdownguide.org/basic-syntax/#italic">"Basic Syntax: Italic"</a>. <i>The Markdown Guide</i>. Matt Cone. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20220326234942/https://www.markdownguide.org/basic-syntax/#italic">Archived</a> from the original on 26 March 2022<span class="reference-accessdate">. Retrieved <span class="nowrap">27 March</span> 2022</span>. <q>To italicize text, add one asterisk or underscore before and after a word or phrase. To italicize the middle of a word for emphasis, add one asterisk without spaces around the letters.</q></cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=The+Markdown+Guide&amp;rft.atitle=Basic+Syntax%3A+Italic&amp;rft_id=https%3A%2F%2Fwww.markdownguide.org%2Fbasic-syntax%2F%23italic&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-39"><span class="mw-cite-backlink"><b><a href="#cite_ref-39">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFTom_Preston-Werner" class="citation web cs1"><a href="/wiki/Tom_Preston-Werner" title="Tom Preston-Werner">Tom Preston-Werner</a>. <a rel="nofollow" class="external text" href="https://github.com/mojombo/github-flavored-markdown/issues/1">"GitHub Flavored Markdown Examples"</a>. <i>GitHub</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20210513154115/https://github.com/mojombo/github-flavored-markdown/issues/1">Archived</a> from the original on 2021-05-13<span class="reference-accessdate">. Retrieved <span class="nowrap">2021-04-02</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=GitHub&amp;rft.atitle=GitHub+Flavored+Markdown+Examples&amp;rft.au=Tom+Preston-Werner&amp;rft_id=https%3A%2F%2Fgithub.com%2Fmojombo%2Fgithub-flavored-markdown%2Fissues%2F1&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-40"><span class="mw-cite-backlink"><b><a href="#cite_ref-40">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://githubengineering.com/a-formal-spec-for-github-markdown/">"A formal spec for GitHub Flavored Markdown"</a>. <i>GitHub Engineering</i>. 14 March 2017. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200203205138/https://githubengineering.com/a-formal-spec-for-github-markdown/">Archived</a> from the original on 3 February 2020<span class="reference-accessdate">. Retrieved <span class="nowrap">16 Mar</span> 2017</span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=GitHub+Engineering&amp;rft.atitle=A+formal+spec+for+GitHub+Flavored+Markdown&amp;rft.date=2017-03-14&amp;rft_id=https%3A%2F%2Fgithubengineering.com%2Fa-formal-spec-for-github-markdown%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-fortin-2018-41"><span class="mw-cite-backlink"><b><a href="#cite_ref-fortin-2018_41-0">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite id="CITEREFFortin2018" class="citation web cs1">Fortin, Michel (2018). <a rel="nofollow" class="external text" href="https://michelf.ca/projects/php-markdown/extra">"PHP Markdown Extra"</a>. <i>Michel Fortin website</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20210117015819/https://michelf.ca/projects/php-markdown/extra/">Archived</a> from the original on 2021-01-17<span class="reference-accessdate">. Retrieved <span class="nowrap">2018-12-26</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Michel+Fortin+website&amp;rft.atitle=PHP+Markdown+Extra&amp;rft.date=2018&amp;rft.aulast=Fortin&amp;rft.aufirst=Michel&amp;rft_id=https%3A%2F%2Fmichelf.ca%2Fprojects%2Fphp-markdown%2Fextra&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-42"><span class="mw-cite-backlink"><b><a href="#cite_ref-42">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://michelf.ca/projects/php-markdown/extra">"PHP Markdown Extra"</a>. <i>Michel Fortin</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20210117015819/https://michelf.ca/projects/php-markdown/extra/">Archived</a> from the original on 2021-01-17<span class="reference-accessdate">. Retrieved <span class="nowrap">2018-12-26</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=Michel+Fortin&amp;rft.atitle=PHP+Markdown+Extra&amp;rft_id=https%3A%2F%2Fmichelf.ca%2Fprojects%2Fphp-markdown%2Fextra&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-43"><span class="mw-cite-backlink"><b><a href="#cite_ref-43">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://drupal.org/project/markdowneditor">"Markdown editor for BUEditor"</a>. 4 December 2008. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200917172201/https://www.drupal.org/project/markdowneditor">Archived</a> from the original on 17 September 2020<span class="reference-accessdate">. Retrieved <span class="nowrap">15 January</span> 2017</span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=unknown&amp;rft.btitle=Markdown+editor+for+BUEditor&amp;rft.date=2008-12-04&amp;rft_id=https%3A%2F%2Fdrupal.org%2Fproject%2Fmarkdowneditor&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-44"><span class="mw-cite-backlink"><b><a href="#cite_ref-44">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://extensions.typo3.org/extension/markdown_content/">"Markdown for TYPO3 (markdown_content)"</a>. <i>extensions.typo3.org</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20210201205749/https://extensions.typo3.org/extension/markdown_content/">Archived</a> from the original on 2021-02-01<span class="reference-accessdate">. Retrieved <span class="nowrap">2019-02-06</span></span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=extensions.typo3.org&amp;rft.atitle=Markdown+for+TYPO3+%28markdown_content%29&amp;rft_id=https%3A%2F%2Fextensions.typo3.org%2Fextension%2Fmarkdown_content%2F&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
<li id="cite_note-45"><span class="mw-cite-backlink"><b><a href="#cite_ref-45">^</a></b></span> <span class="reference-text"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1238218222" /><cite class="citation web cs1"><a rel="nofollow" class="external text" href="https://www.w3.org/community/markdown/wiki/MarkdownImplementations">"W3C Community Page of Markdown Implementations"</a>. <i>W3C Markdown Wiki</i>. <a rel="nofollow" class="external text" href="https://web.archive.org/web/20200917231621/https://www.w3.org/community/markdown/wiki/MarkdownImplementations">Archived</a> from the original on 17 September 2020<span class="reference-accessdate">. Retrieved <span class="nowrap">24 March</span> 2016</span>.</cite><span title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&amp;rft.genre=unknown&amp;rft.jtitle=W3C+Markdown+Wiki&amp;rft.atitle=W3C+Community+Page+of+Markdown+Implementations&amp;rft_id=https%3A%2F%2Fwww.w3.org%2Fcommunity%2Fmarkdown%2Fwiki%2FMarkdownImplementations&amp;rfr_id=info%3Asid%2Fen.wikipedia.org%3AMarkdown" class="Z3988"></span></span>
</li>
</ol></div>
<div class="mw-heading mw-heading2"><h2 id="External_links">External links</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Markdown&amp;action=edit&amp;section=12" title="Edit section: External links"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>
<ul><li><span class="official-website"><span class="url"><a rel="nofollow" class="external text" href="https://daringfireball.net/projects/markdown/">Official website</a></span></span> for original John Gruber markup</li></ul>
<div class="navbox-styles"><style data-mw-deduplicate="TemplateStyles:r1129693374">.mw-parser-output .hlist dl,.mw-parser-output .hlist ol,.mw-parser-output .hlist ul{margin:0;padding:0}.mw-parser-output .hlist dd,.mw-parser-output .hlist dt,.mw-parser-output .hlist li{margin:0;display:inline}.mw-parser-output .hlist.inline,.mw-parser-output .hlist.inline dl,.mw-parser-output .hlist.inline ol,.mw-parser-output .hlist.inline ul,.mw-parser-output .hlist dl dl,.mw-parser-output .hlist dl ol,.mw-parser-output .hlist dl ul,.mw-parser-output .hlist ol dl,.mw-parser-output .hlist ol ol,.mw-parser-output .hlist ol ul,.mw-parser-output .hlist ul dl,.mw-parser-output .hlist ul ol,.mw-parser-output .hlist ul ul{display:inline}.mw-parser-output .hlist .mw-empty-li{display:none}.mw-parser-output .hlist dt::after{content:": "}.mw-parser-output .hlist dd::after,.mw-parser-output .hlist li::after{content:" · ";font-weight:bold}.mw-parser-output .hlist dd:last-child::after,.mw-parser-output .hlist dt:last-child::after,.mw-parser-output .hlist li:last-child::after{content:none}.mw-parser-output .hlist dd dd:first-child::before,.mw-parser-output .hlist dd dt:first-child::before,.mw-parser-output .hlist dd li:first-child::before,.mw-parser-output .hlist dt dd:first-child::before,.mw-parser-output .hlist dt dt:first-child::before,.mw-parser-output .hlist dt li:first-child::before,.mw-parser-output .hlist li dd:first-child::before,.mw-parser-output .hlist li dt:first-child::before,.mw-parser-output .hlist li li:first-child::before{content:" (";font-weight:normal}.mw-parser-output .hlist dd dd:last-child::after,.mw-parser-output .hlist dd dt:last-child::after,.mw-parser-output .hlist dd li:last-child::after,.mw-parser-output .hlist dt dd:last-child::after,.mw-parser-output .hlist dt dt:last-child::after,.mw-parser-output .hlist dt li:last-child::after,.mw-parser-output .hlist li dd:last-child::after,.mw-parser-output .hlist li dt:last-child::after,.mw-parser-output .hlist li li:last-child::after{content:")";font-weight:normal}.mw-parser-output .hlist ol{counter-reset:listitem}.mw-parser-output .hlist ol>li{counter-increment:listitem}.mw-parser-output .hlist ol>li::before{content:" "counter(listitem)"\\a0 "}.mw-parser-output .hlist dd ol>li:first-child::before,.mw-parser-output .hlist dt ol>li:first-child::before,.mw-parser-output .hlist li ol>li:first-child::before{content:" ("counter(listitem)"\\a0 "}</style><style data-mw-deduplicate="TemplateStyles:r1236075235">.mw-parser-output .navbox{box-sizing:border-box;border:1px solid #a2a9b1;width:100%;clear:both;font-size:88%;text-align:center;padding:1px;margin:1em auto 0}.mw-parser-output .navbox .navbox{margin-top:0}.mw-parser-output .navbox+.navbox,.mw-parser-output .navbox+.navbox-styles+.navbox{margin-top:-1px}.mw-parser-output .navbox-inner,.mw-parser-output .navbox-subgroup{width:100%}.mw-parser-output .navbox-group,.mw-parser-output .navbox-title,.mw-parser-output .navbox-abovebelow{padding:0.25em 1em;line-height:1.5em;text-align:center}.mw-parser-output .navbox-group{white-space:nowrap;text-align:right}.mw-parser-output .navbox,.mw-parser-output .navbox-subgroup{background-color:#fdfdfd}.mw-parser-output .navbox-list{line-height:1.5em;border-color:#fdfdfd}.mw-parser-output .navbox-list-with-group{text-align:left;border-left-width:2px;border-left-style:solid}.mw-parser-output tr+tr>.navbox-abovebelow,.mw-parser-output tr+tr>.navbox-group,.mw-parser-output tr+tr>.navbox-image,.mw-parser-output tr+tr>.navbox-list{border-top:2px solid #fdfdfd}.mw-parser-output .navbox-title{background-color:#ccf}.mw-parser-output .navbox-abovebelow,.mw-parser-output .navbox-group,.mw-parser-output .navbox-subgroup .navbox-title{background-color:#ddf}.mw-parser-output .navbox-subgroup .navbox-group,.mw-parser-output .navbox-subgroup .navbox-abovebelow{background-color:#e6e6ff}.mw-parser-output .navbox-even{background-color:#f7f7f7}.mw-parser-output .navbox-odd{background-color:transparent}.mw-parser-output .navbox .hlist td dl,.mw-parser-output .navbox .hlist td ol,.mw-parser-output .navbox .hlist td ul,.mw-parser-output .navbox td.hlist dl,.mw-parser-output .navbox td.hlist ol,.mw-parser-output .navbox td.hlist ul{padding:0.125em 0}.mw-parser-output .navbox .navbar{display:block;font-size:100%}.mw-parser-output .navbox-title .navbar{float:left;text-align:left;margin-right:0.5em}body.skin--responsive .mw-parser-output .navbox-image img{max-width:none!important}@media print{body.ns-0 .mw-parser-output .navbox{display:none!important}}</style></div><div role="navigation" class="navbox" aria-labelledby="Document_markup_languages120" style="padding:3px"><table class="nowraplinks mw-collapsible autocollapse navbox-inner" style="border-spacing:0;background:transparent;color:inherit"><tbody><tr><th scope="col" class="navbox-title" colspan="2"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1129693374" /><style data-mw-deduplicate="TemplateStyles:r1239400231">.mw-parser-output .navbar{display:inline;font-size:88%;font-weight:normal}.mw-parser-output .navbar-collapse{float:left;text-align:left}.mw-parser-output .navbar-boxtext{word-spacing:0}.mw-parser-output .navbar ul{display:inline-block;white-space:nowrap;line-height:inherit}.mw-parser-output .navbar-brackets::before{margin-right:-0.125em;content:"[ "}.mw-parser-output .navbar-brackets::after{margin-left:-0.125em;content:" ]"}.mw-parser-output .navbar li{word-spacing:-0.125em}.mw-parser-output .navbar a>span,.mw-parser-output .navbar a>abbr{text-decoration:inherit}.mw-parser-output .navbar-mini abbr{font-variant:small-caps;border-bottom:none;text-decoration:none;cursor:inherit}.mw-parser-output .navbar-ct-full{font-size:114%;margin:0 7em}.mw-parser-output .navbar-ct-mini{font-size:114%;margin:0 4em}html.skin-theme-clientpref-night .mw-parser-output .navbar li a abbr{color:var(--color-base)!important}@media(prefers-color-scheme:dark){html.skin-theme-clientpref-os .mw-parser-output .navbar li a abbr{color:var(--color-base)!important}}@media print{.mw-parser-output .navbar{display:none!important}}</style><div class="navbar plainlinks hlist navbar-mini"><ul><li class="nv-view"><a href="/wiki/Template:Document_markup_languages" title="Template:Document markup languages"><abbr title="View this template">v</abbr></a></li><li class="nv-talk"><a href="/wiki/Template_talk:Document_markup_languages" title="Template talk:Document markup languages"><abbr title="Discuss this template">t</abbr></a></li><li class="nv-edit"><a href="/wiki/Special:EditPage/Template:Document_markup_languages" title="Special:EditPage/Template:Document markup languages"><abbr title="Edit this template">e</abbr></a></li></ul></div><div id="Document_markup_languages120" style="font-size:114%;margin:0 4em"><a href="/wiki/Markup_language" title="Markup language">Document markup languages</a></div></th></tr><tr><th scope="row" class="navbox-group" style="width:1%"><a href="/wiki/Office_suite" class="mw-redirect" title="Office suite">Office suite</a></th><td class="navbox-list-with-group navbox-list navbox-odd hlist" style="width:100%;padding:0"><div style="padding:0 0.25em">
<ul><li><a href="/wiki/Compound_Document_Format" title="Compound Document Format">Compound Document Format</a></li>
<li><a href="/wiki/Office_Open_XML" title="Office Open XML">OOXML</a>
<ul><li><a href="/wiki/SpreadsheetML" title="SpreadsheetML">SpreadsheetML</a></li>
<li><a href="/wiki/PresentationML" class="mw-redirect" title="PresentationML">PresentationML</a></li>
<li><a href="/wiki/WordprocessingML" class="mw-redirect" title="WordprocessingML">WordprocessingML</a></li></ul></li>
<li><a href="/wiki/OpenDocument" title="OpenDocument">ODF</a></li>
<li><a href="/wiki/Uniform_Office_Format" title="Uniform Office Format">UOF</a></li></ul>
</div></td></tr><tr><th scope="row" class="navbox-group" style="width:1%">Well-known</th><td class="navbox-list-with-group navbox-list navbox-even hlist" style="width:100%;padding:0"><div style="padding:0 0.25em">
<ul><li><a href="/wiki/HTML" title="HTML">HTML</a></li>
<li><a href="/wiki/XHTML" title="XHTML">XHTML</a></li>
<li><a href="/wiki/MathML" title="MathML">MathML</a></li>
<li><a href="/wiki/Rich_Text_Format" title="Rich Text Format">RTF</a></li>
<li><a href="/wiki/TeX" title="TeX">TeX</a></li>
<li><a href="/wiki/LaTeX" title="LaTeX">LaTeX</a></li>
<li><a class="mw-selflink selflink">Markdown</a></li></ul>
</div></td></tr><tr><th scope="row" class="navbox-group" style="width:1%">Lesser-known</th><td class="navbox-list-with-group navbox-list navbox-odd hlist" style="width:100%;padding:0"><div style="padding:0 0.25em">
<ul><li><a href="/wiki/AmigaGuide" title="AmigaGuide">AmigaGuide</a></li>
<li><a href="/wiki/AsciiDoc" title="AsciiDoc">AsciiDoc</a></li>
<li><a href="/wiki/BBCode" title="BBCode">BBCode</a></li>
<li><a href="/wiki/Chemical_Markup_Language" title="Chemical Markup Language">CML</a></li>
<li><a href="/wiki/C-HTML" class="mw-redirect" title="C-HTML">C-HTML</a></li>
<li><a href="/wiki/ConTeXt" title="ConTeXt">ConTeXt</a></li>
<li><a href="/wiki/CrossMark" class="mw-redirect" title="CrossMark">CrossMark</a></li>
<li><a href="/wiki/Darwin_Information_Typing_Architecture" title="Darwin Information Typing Architecture">DITA</a></li>
<li><a href="/wiki/DocBook" title="DocBook">DocBook</a></li>
<li><a href="/wiki/Encoded_Archival_Description" title="Encoded Archival Description">EAD</a></li>
<li><a href="/wiki/Enriched_text" title="Enriched text">Enriched text</a></li>
<li><a href="/wiki/FHTML" title="FHTML">FHTML</a></li>
<li><a href="/wiki/List_of_document_markup_languages#GML_Disambiguation" title="List of document markup languages">GML</a></li>
<li><a href="/wiki/GuideML" class="mw-redirect" title="GuideML">GuideML</a></li>
<li><a href="/wiki/Handheld_Device_Markup_Language" title="Handheld Device Markup Language">HDML</a></li>
<li><a href="/wiki/HyTime" title="HyTime">HyTime</a></li>
<li><a href="/wiki/Information_Presentation_Facility" title="Information Presentation Facility">IPF</a></li>
<li><a href="/wiki/LilyPond" title="LilyPond">LilyPond</a></li>
<li><a href="/wiki/LinuxDoc" title="LinuxDoc">LinuxDoc</a></li>
<li>Lout</li>
<li><a href="/wiki/Maker_Interchange_Format" class="mw-redirect" title="Maker Interchange Format">MIF</a></li>
<li><a href="/wiki/Microsoft_Assistance_Markup_Language" title="Microsoft Assistance Markup Language">MAML</a></li>
<li><a href="/wiki/Music_Encoding_Initiative" title="Music Encoding Initiative">MEI</a></li>
<li><a href="/wiki/MusicXML" title="MusicXML">MusicXML</a></li>
<li><a href="/wiki/OMDoc" title="OMDoc">OMDoc</a></li>
<li><a href="/wiki/OpenMath" title="OpenMath">OpenMath</a></li>
<li><a href="/wiki/Org-mode" title="Org-mode">Org-mode</a></li>
<li><a href="/wiki/Plain_Old_Documentation" title="Plain Old Documentation">POD</a></li>
<li><a href="/wiki/ReStructuredText" title="ReStructuredText">ReStructuredText</a></li>
<li><a href="/wiki/RTML" title="RTML">RTML</a></li>
<li><a href="/wiki/Revisable-Form_Text" class="mw-redirect" title="Revisable-Form Text">RFT</a></li>
<li><a href="/wiki/S1000D" title="S1000D">S1000D</a></li>
<li><a href="/wiki/Setext" title="Setext">Setext</a></li>
<li><a href="/wiki/Text_Encoding_Initiative" title="Text Encoding Initiative">TEI</a></li>
<li><a href="/wiki/Texinfo" title="Texinfo">Texinfo</a></li>
<li><a href="/wiki/Troff" title="Troff">troff</a></li>
<li><a href="/wiki/Wiki#Editing" title="Wiki">Wikitext</a></li>
<li><a href="/wiki/Wireless_Markup_Language" title="Wireless Markup Language">WML</a></li>
<li><a href="/wiki/WapTV" title="WapTV">WapTV</a></li>
<li><a href="/wiki/Extensible_Application_Markup_Language" title="Extensible Application Markup Language">XAML</a></li></ul>
</div></td></tr><tr><td class="navbox-abovebelow" colspan="2"><div><a href="/wiki/List_of_document_markup_languages" title="List of document markup languages">List of document markup languages</a></div></td></tr></tbody></table></div>
<div class="navbox-styles"><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1129693374" /><link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1236075235" /><style data-mw-deduplicate="TemplateStyles:r1038841319">.mw-parser-output .tooltip-dotted{border-bottom:1px dotted;cursor:help}</style></div><div role="navigation" class="navbox authority-control" aria-labelledby="Authority_control_databases_frameless&amp;#124;text-top&amp;#124;10px&amp;#124;alt=Edit_this_at_Wikidata&amp;#124;link=https&amp;#58;//www.wikidata.org/wiki/Q1193600#identifiers&amp;#124;class=noprint&amp;#124;Edit_this_at_Wikidata754" style="padding:3px"><table class="nowraplinks hlist mw-collapsible autocollapse navbox-inner" style="border-spacing:0;background:transparent;color:inherit"><tbody><tr><th scope="col" class="navbox-title" colspan="2"><div id="Authority_control_databases_frameless&amp;#124;text-top&amp;#124;10px&amp;#124;alt=Edit_this_at_Wikidata&amp;#124;link=https&amp;#58;//www.wikidata.org/wiki/Q1193600#identifiers&amp;#124;class=noprint&amp;#124;Edit_this_at_Wikidata754" style="font-size:114%;margin:0 4em"><a href="/wiki/Help:Authority_control" title="Help:Authority control">Authority control databases</a> <span class="mw-valign-text-top noprint" typeof="mw:File/Frameless"><a href="https://www.wikidata.org/wiki/Q1193600#identifiers" title="Edit this at Wikidata"><img alt="Edit this at Wikidata" src="//upload.wikimedia.org/wikipedia/en/thumb/8/8a/OOjs_UI_icon_edit-ltr-progressive.svg/20px-OOjs_UI_icon_edit-ltr-progressive.svg.png" decoding="async" width="10" height="10" class="mw-file-element" data-file-width="20" data-file-height="20" /></a></span></div></th></tr><tr><th scope="row" class="navbox-group" style="width:1%">International</th><td class="navbox-list-with-group navbox-list navbox-odd" style="width:100%;padding:0"><div style="padding:0 0.25em"><ul><li><span class="uid"><a rel="nofollow" class="external text" href="http://id.worldcat.org/fast/1931102/">FAST</a></span></li></ul></div></td></tr><tr><th scope="row" class="navbox-group" style="width:1%">National</th><td class="navbox-list-with-group navbox-list navbox-even" style="width:100%;padding:0"><div style="padding:0 0.25em"><ul><li><span class="uid"><span class="rt-commentedText tooltip tooltip-dotted" title="Markdown (Document markup language)"><a rel="nofollow" class="external text" href="https://id.loc.gov/authorities/sh2015002740">United States</a></span></span></li><li><span class="uid"><a rel="nofollow" class="external text" href="https://www.nli.org.il/en/authorities/987007415877105171">Israel</a></span></li></ul></div></td></tr></tbody></table></div>
<!--
NewPP limit report
Parsed by mw‐web.codfw.main‐767c977f85‐x76xg
Cached time: 20250419115116
Cache expiry: 2592000
Reduced expiry: false
Complications: [vary‐revision‐sha1, show‐toc]
CPU time usage: 0.625 seconds
Real time usage: 0.762 seconds
Preprocessor visited node count: 5669/1000000
Post‐expand include size: 117694/2097152 bytes
Template argument size: 11964/2097152 bytes
Highest expansion depth: 24/100
Expensive parser function count: 15/500
Unstrip recursion depth: 1/20
Unstrip post‐expand size: 187359/5000000 bytes
Lua time usage: 0.366/10.000 seconds
Lua memory usage: 7087275/52428800 bytes
Number of Wikibase entities loaded: 1/500
-->
<!--
Transclusion expansion time report (%,ms,calls,template)
100.00%  669.838      1 -total
 33.99%  227.653     39 Template:Cite_web
 30.88%  206.826      2 Template:Reflist
 19.87%  133.090      3 Template:R
 18.92%  126.742      3 Template:R/ref
 15.45%  103.471      2 Template:Infobox_file_format
 14.75%   98.823      2 Template:Infobox
 11.42%   76.483      1 Template:Document_markup_languages
 10.63%   71.196      1 Template:Navbox
 10.07%   67.445      1 Template:Short_description
-->

<!-- Saved in parser cache with key enwiki:pcache:2415885:|#|:idhash:canonical and timestamp 20250419115116 and revision id 1285991210. Rendering was triggered because: page-view
 -->
</div><!--esi <esi:include src="/esitest-fa8a495983347898/content" /> --><noscript><img src="https://en.wikipedia.org/wiki/Special:CentralAutoLogin/start?type=1x1&amp;usesul3=1" alt="" width="1" height="1" style="border: none; position: absolute;"></noscript>
<div class="printfooter" data-nosnippet="">Retrieved from "<a dir="ltr" href="https://en.wikipedia.org/w/index.php?title=Markdown&amp;oldid=1285991210">https://en.wikipedia.org/w/index.php?title=Markdown&amp;oldid=1285991210</a>"</div></div>
\t\t\t\t\t<div id="catlinks" class="catlinks" data-mw="interface"><div id="mw-normal-catlinks" class="mw-normal-catlinks"><a href="/wiki/Help:Category" title="Help:Category">Categories</a>: <ul><li><a href="/wiki/Category:Computer-related_introductions_in_2004" title="Category:Computer-related introductions in 2004">Computer-related introductions in 2004</a></li><li><a href="/wiki/Category:Lightweight_markup_languages" title="Category:Lightweight markup languages">Lightweight markup languages</a></li><li><a href="/wiki/Category:Open_formats" title="Category:Open formats">Open formats</a></li></ul></div><div id="mw-hidden-catlinks" class="mw-hidden-catlinks mw-hidden-cats-hidden">Hidden categories: <ul><li><a href="/wiki/Category:Articles_with_short_description" title="Category:Articles with short description">Articles with short description</a></li><li><a href="/wiki/Category:Short_description_is_different_from_Wikidata" title="Category:Short description is different from Wikidata">Short description is different from Wikidata</a></li></ul></div></div>
\t\t\t\t</div>
\t\t\t</main>
\t\t\t
\t\t</div>
\t\t<div class="mw-footer-container">
\t\t\t
<footer id="footer" class="mw-footer" >
\t<ul id="footer-info">
\t<li id="footer-info-lastmod"> This page was last edited on 17 April 2025, at 01:19<span class="anonymous-show">&#160;(UTC)</span>.</li>
\t<li id="footer-info-copyright">Text is available under the <a href="/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License" title="Wikipedia:Text of the Creative Commons Attribution-ShareAlike 4.0 International License">Creative Commons Attribution-ShareAlike 4.0 License</a>;
additional terms may apply. By using this site, you agree to the <a href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Terms_of_Use" class="extiw" title="foundation:Special:MyLanguage/Policy:Terms of Use">Terms of Use</a> and <a href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Privacy_policy" class="extiw" title="foundation:Special:MyLanguage/Policy:Privacy policy">Privacy Policy</a>. Wikipedia® is a registered trademark of the <a rel="nofollow" class="external text" href="https://wikimediafoundation.org/">Wikimedia Foundation, Inc.</a>, a non-profit organization.</li>
</ul>

\t<ul id="footer-places">
\t<li id="footer-places-privacy"><a href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Privacy_policy">Privacy policy</a></li>
\t<li id="footer-places-about"><a href="/wiki/Wikipedia:About">About Wikipedia</a></li>
\t<li id="footer-places-disclaimers"><a href="/wiki/Wikipedia:General_disclaimer">Disclaimers</a></li>
\t<li id="footer-places-contact"><a href="//en.wikipedia.org/wiki/Wikipedia:Contact_us">Contact Wikipedia</a></li>
\t<li id="footer-places-wm-codeofconduct"><a href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Universal_Code_of_Conduct">Code of Conduct</a></li>
\t<li id="footer-places-developers"><a href="https://developer.wikimedia.org">Developers</a></li>
\t<li id="footer-places-statslink"><a href="https://stats.wikimedia.org/#/en.wikipedia.org">Statistics</a></li>
\t<li id="footer-places-cookiestatement"><a href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Cookie_statement">Cookie statement</a></li>
\t<li id="footer-places-mobileview"><a href="//en.m.wikipedia.org/w/index.php?title=Markdown&amp;mobileaction=toggle_view_mobile" class="noprint stopMobileRedirectToggle">Mobile view</a></li>
</ul>

\t<ul id="footer-icons" class="noprint">
\t<li id="footer-copyrightico"><a href="https://www.wikimedia.org/" class="cdx-button cdx-button--fake-button cdx-button--size-large cdx-button--fake-button--enabled"><picture><source media="(min-width: 500px)" srcset="/static/images/footer/wikimedia-button.svg" width="84" height="29"><img src="/static/images/footer/wikimedia.svg" width="25" height="25" alt="Wikimedia Foundation" lang="en" loading="lazy"></picture></a></li>
\t<li id="footer-poweredbyico"><a href="https://www.mediawiki.org/" class="cdx-button cdx-button--fake-button cdx-button--size-large cdx-button--fake-button--enabled"><picture><source media="(min-width: 500px)" srcset="/w/resources/assets/poweredby_mediawiki.svg" width="88" height="31"><img src="/w/resources/assets/mediawiki_compact.svg" alt="Powered by MediaWiki" lang="en" width="25" height="25" loading="lazy"></picture></a></li>
</ul>

</footer>

\t\t</div>
\t</div>
</div>
<div class="vector-header-container vector-sticky-header-container">
\t<div id="vector-sticky-header" class="vector-sticky-header">
\t\t<div class="vector-sticky-header-start">
\t\t\t<div class="vector-sticky-header-icon-start vector-button-flush-left vector-button-flush-right" aria-hidden="true">
\t\t\t\t<button class="cdx-button cdx-button--weight-quiet cdx-button--icon-only vector-sticky-header-search-toggle" tabindex="-1" data-event-name="ui.vector-sticky-search-form.icon"><span class="vector-icon mw-ui-icon-search mw-ui-icon-wikimedia-search"></span>

<span>Search</span>
\t\t\t</button>
\t\t</div>
\t\t\t
\t\t<div role="search" class="vector-search-box-vue  vector-search-box-show-thumbnail vector-search-box">
\t\t\t<div class="vector-typeahead-search-container">
\t\t\t\t<div class="cdx-typeahead-search cdx-typeahead-search--show-thumbnail">
\t\t\t\t\t<form action="/w/index.php" id="vector-sticky-search-form" class="cdx-search-input cdx-search-input--has-end-button">
\t\t\t\t\t\t<div  class="cdx-search-input__input-wrapper"  data-search-loc="header-moved">
\t\t\t\t\t\t\t<div class="cdx-text-input cdx-text-input--has-start-icon">
\t\t\t\t\t\t\t\t<input
\t\t\t\t\t\t\t\t\tclass="cdx-text-input__input"
\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\ttype="search" name="search" placeholder="Search Wikipedia">
\t\t\t\t\t\t\t\t<span class="cdx-text-input__icon cdx-text-input__start-icon"></span>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<input type="hidden" name="title" value="Special:Search">
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<button class="cdx-button cdx-search-input__end-button">Search</button>
\t\t\t\t\t</form>
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t\t<div class="vector-sticky-header-context-bar">
\t\t\t\t<nav aria-label="Contents" class="vector-toc-landmark">
\t\t\t\t\t\t
\t\t\t\t\t<div id="vector-sticky-header-toc" class="vector-dropdown mw-portlet mw-portlet-sticky-header-toc vector-sticky-header-toc vector-button-flush-left"  >
\t\t\t\t\t\t<input type="checkbox" id="vector-sticky-header-toc-checkbox" role="button" aria-haspopup="true" data-event-name="ui.dropdown-vector-sticky-header-toc" class="vector-dropdown-checkbox "  aria-label="Toggle the table of contents"  >
\t\t\t\t\t\t<label id="vector-sticky-header-toc-label" for="vector-sticky-header-toc-checkbox" class="vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only " aria-hidden="true"  ><span class="vector-icon mw-ui-icon-listBullet mw-ui-icon-wikimedia-listBullet"></span>

<span class="vector-dropdown-label-text">Toggle the table of contents</span>
\t\t\t\t\t\t</label>
\t\t\t\t\t\t<div class="vector-dropdown-content">
\t\t\t\t\t
\t\t\t\t\t\t<div id="vector-sticky-header-toc-unpinned-container" class="vector-unpinned-container">
\t\t\t\t\t\t</div>
\t\t\t\t\t
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t</nav>
\t\t\t\t<div class="vector-sticky-header-context-bar-primary" aria-hidden="true" ><span class="mw-page-title-main">Markdown</span></div>
\t\t\t</div>
\t\t</div>
\t\t<div class="vector-sticky-header-end" aria-hidden="true">
\t\t\t<div class="vector-sticky-header-icons">
\t\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-talk-sticky-header" tabindex="-1" data-event-name="talk-sticky-header"><span class="vector-icon mw-ui-icon-speechBubbles mw-ui-icon-wikimedia-speechBubbles"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-subject-sticky-header" tabindex="-1" data-event-name="subject-sticky-header"><span class="vector-icon mw-ui-icon-article mw-ui-icon-wikimedia-article"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-history-sticky-header" tabindex="-1" data-event-name="history-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-history mw-ui-icon-wikimedia-wikimedia-history"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only mw-watchlink" id="ca-watchstar-sticky-header" tabindex="-1" data-event-name="watch-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-star mw-ui-icon-wikimedia-wikimedia-star"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-edit-sticky-header" tabindex="-1" data-event-name="wikitext-edit-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-wikiText mw-ui-icon-wikimedia-wikimedia-wikiText"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-ve-edit-sticky-header" tabindex="-1" data-event-name="ve-edit-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-edit mw-ui-icon-wikimedia-wikimedia-edit"></span>

<span></span>
\t\t\t</a>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only" id="ca-viewsource-sticky-header" tabindex="-1" data-event-name="ve-edit-protected-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-editLock mw-ui-icon-wikimedia-wikimedia-editLock"></span>

<span></span>
\t\t\t</a>
\t\t</div>
\t\t\t<div class="vector-sticky-header-buttons">
\t\t\t\t<button class="cdx-button cdx-button--weight-quiet mw-interlanguage-selector" id="p-lang-btn-sticky-header" tabindex="-1" data-event-name="ui.dropdown-p-lang-btn-sticky-header"><span class="vector-icon mw-ui-icon-wikimedia-language mw-ui-icon-wikimedia-wikimedia-language"></span>

<span>31 languages</span>
\t\t\t</button>
\t\t\t<a href="#" class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--action-progressive" id="ca-addsection-sticky-header" tabindex="-1" data-event-name="addsection-sticky-header"><span class="vector-icon mw-ui-icon-speechBubbleAdd-progressive mw-ui-icon-wikimedia-speechBubbleAdd-progressive"></span>

<span>Add topic</span>
\t\t\t</a>
\t\t</div>
\t\t\t<div class="vector-sticky-header-icon-end">
\t\t\t\t<div class="vector-user-links">
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</div>
</div>
<div class="mw-portlet mw-portlet-dock-bottom emptyPortlet" id="p-dock-bottom">
\t<ul>
\t\t
\t</ul>
</div>
<script>(RLQ=window.RLQ||[]).push(function(){mw.config.set({"wgHostname":"mw-web.codfw.main-767c977f85-2rzhs","wgBackendResponseTime":150,"wgPageParseReport":{"limitreport":{"cputime":"0.625","walltime":"0.762","ppvisitednodes":{"value":5669,"limit":1000000},"postexpandincludesize":{"value":117694,"limit":2097152},"templateargumentsize":{"value":11964,"limit":2097152},"expansiondepth":{"value":24,"limit":100},"expensivefunctioncount":{"value":15,"limit":500},"unstrip-depth":{"value":1,"limit":20},"unstrip-size":{"value":187359,"limit":5000000},"entityaccesscount":{"value":1,"limit":500},"timingprofile":["100.00%  669.838      1 -total"," 33.99%  227.653     39 Template:Cite_web"," 30.88%  206.826      2 Template:Reflist"," 19.87%  133.090      3 Template:R"," 18.92%  126.742      3 Template:R/ref"," 15.45%  103.471      2 Template:Infobox_file_format"," 14.75%   98.823      2 Template:Infobox"," 11.42%   76.483      1 Template:Document_markup_languages"," 10.63%   71.196      1 Template:Navbox"," 10.07%   67.445      1 Template:Short_description"]},"scribunto":{"limitreport-timeusage":{"value":"0.366","limit":"10.000"},"limitreport-memusage":{"value":7087275,"limit":52428800}},"cachereport":{"origin":"mw-web.codfw.main-767c977f85-x76xg","timestamp":"20250419115116","ttl":2592000,"transientcontent":false}}});});</script>
<script type="application/ld+json">{"@context":"https:\\/\\/schema.org","@type":"Article","name":"Markdown","url":"https:\\/\\/en.wikipedia.org\\/wiki\\/Markdown","sameAs":"http:\\/\\/www.wikidata.org\\/entity\\/Q1193600","mainEntity":"http:\\/\\/www.wikidata.org\\/entity\\/Q1193600","author":{"@type":"Organization","name":"Contributors to Wikimedia projects"},"publisher":{"@type":"Organization","name":"Wikimedia Foundation, Inc.","logo":{"@type":"ImageObject","url":"https:\\/\\/www.wikimedia.org\\/static\\/images\\/wmf-hor-googpub.png"}},"datePublished":"2005-08-09T19:56:00Z","dateModified":"2025-04-17T01:19:08Z","image":"https:\\/\\/upload.wikimedia.org\\/wikipedia\\/commons\\/4\\/48\\/Markdown-mark.svg","headline":"plain-text formatting syntax, which is popularly used to format readme files"}</script>
</body>
</html>`

async function run() {
  // read times to run it from command line argument
  const times = Number.parseInt(process.argv[2], 10) || 1
  const start = performance.now()
  // extend the timings
  for (let i = 0; i < times; i++) {
    await asyncHtmlToMarkdown(html)
  }
  const end = performance.now()
  const duration = end - start
  console.log(`\n\nFetched and converted ${times} times in ${duration.toFixed(2)} ms`)
}

run()
