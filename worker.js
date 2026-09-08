const ANIGENRE_ORIGIN = 'https://anigenre.asesar466.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/anigenre') {
      return Response.redirect(url.origin + '/anigenre/', 301);
    }
    if (url.pathname === '/secadmin') {
      return Response.redirect(url.origin + '/secadmin/', 301);
    }

    if (url.pathname.startsWith('/anigenre/')) {
      const targetPath = url.pathname.slice('/anigenre'.length);
      return fetch(ANIGENRE_ORIGIN + targetPath + url.search);
    }

    if (url.pathname.startsWith('/secadmin/')) {
      const targetPath = url.pathname.slice('/secadmin'.length);
      return fetch(ANIGENRE_ORIGIN + targetPath + url.search);
    }

    return env.ASSETS.fetch(request);
  }
};
