/*
 * Scrollable jQuery UI Autocomplete
 * https://anseki.github.io/jquery-ui-autocomplete-scroll/
 *
 * Copyright (c) 2018 anseki
 * Licensed under the MIT license.
 */

;(function($, undefined) {
'use strict';

$.widget('ui.autocomplete', $.ui.autocomplete, {
  _resizeMenu: function() {
    var ul, lis, ulW, barW;
    if (isNaN(this.options.maxShowItems)) { return; }
    ul = this.menu.element
      .scrollLeft(0).scrollTop(0) // Reset scroll position
      .css({overflowX: 'hidden', overflowY: 'auto', width: '', maxHeight: ''}); // Restore
    lis = ul.children('li').css('whiteSpace', 'nowrap');

    if (lis.length > this.options.maxShowItems) {
      ulW = ul.prop('clientWidth');
      ul.css({overflowX: 'hidden', overflowY: 'auto',
        maxHeight: lis.eq(0).outerHeight() * this.options.maxShowItems + 1}); // 1px for Firefox
      barW = ulW - ul.prop('clientWidth');
      ul.width('+=' + barW);
    }

    ul.outerWidth("300");  // TODO: hardcoded width is not good.

  }
});

})(jQuery);
