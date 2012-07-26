/**
 * Copyright (c) 2012 Cipix Internet
 * Version: 1.0 (19-07-2012)
 * Dual licensed under the MIT and GPL licenses.
 * http://jquery.malsup.com/license.html
 */
(function($) {
  
/**
 * Adds (horizontal) swiping to a viewport with items.
 
 * Adds swipe events to the specified element(s). The following events will be added:
 * - swipe
 *   This event will be triggered when the element swipe is performed.
 *   Parameters: 
 *   - slideshow
 *     The slideshow object.
 *   - direction
 *     The direction of the swipe: 0 (left) or 1 (right).
 *   - itemIndex
 *     (New) item index.
 *     
 * - moveitem
 *   This event is triggered when a move to another item is started.
 *   Parameters: 
 *   - slideshow
 *     The slideshow object.
 *   - item
 *     The item.
 *   - itemIndex
 *     (New) item index.
 *
 * - changeitem
 *   This event is triggered when the moving has completed.
 *   Parameters: 
 *   - slideshow
 *     The slideshow object.
 *   - item
 *     The item.
 *   - itemIndex
 *     (New) item index.
 *     
 * @param options
 *   This is an object containing the following options:
 *   - minspeed
 *     A swipe is accepted if the swipe's ending speed exceeds this number (in pixels per second).
 *   - mindistance
 *     A swipe is accepted if the swipe distance exceeds this number (in pixels).
 *   - container
 *     Contains the items that can be swiped through. If specified, the container which will be moved. If not specified,
 *     the child 'container' will be used.
 *   - debug
 *     In debug mode, mouse events are used instead of touch events.
 *   - swipeThreshold
 *     The minimal x move before swipe is shown.
 *   - moveFactor
 *     While moving, the difference between the current position and the target position is multiplied with this number and then substracted.
 */
jQuery.fn.swipe = function (options) {
  // Support multiple elements.
  if (this.length > 1){
    this.each(function() { $(this).swipe(options) });
    return this;
  }

  // Check and set options.
  var minspeed = (options && options['minspeed']) ? options['minspeed'] : 500.0;
  var mindistance = (options && options['mindistance']) ? options['mindistance'] : 100.0;
  var debug = (options && options['debug']) ? options['debug'] : false;
  var swipeThreshold = (options && options['swipeThreshold']) ? options['swipeThreshold'] : 0;
  var moveFactor = (options && options['moveFactor']) ? options['moveFactor'] : 0.1;

  // Check and get the container and the items.
  if (options && options['container']) {
    container = $(options['container']);
  } else {
    container = $(this).children('.container').get(0);
  }
  
  if (!container) {
    console.log('Container not found in element:');
    console.log(container);
    return;
  }
  
  var p = $(container).css('position'); 
  if (p != 'relative' && p != 'absolute') {
    // Set relative position, so that 'left' styling has effect.
    $(container).css('position', 'relative');
  }
  
  // Get all items.
  var items = $(container).children();
  
  if (items.length == 0) {
    // Nothing to slide through. This will lead to errors later so just do nothing.
    return;
  }
  
  // Alternative 'this' object.
  var t = this;
  
  // Start state machine.
  var state = 'idle';
  
  // The index of the currently 'active' item.
  var currentItemIndex = 0;
  
  // The index of the item that was active when the user started moving the viewport.
  var startCurrentItemIndex = 0;
  
  // The X position of the mouse when the user first clicks (starting the swipe).
  var startX = 0;
  
  // The Y position of the mouse when the user first clicks. Used for scrolling purposes.
  var startY = 0;
  
  // Start scroll position when the user first clicks. Used for scrolling.
  var startScrollPos = 0;
  
  // The currently known X position of the mouse while swiping.
  var currentX = 0;
  
  // If the swipeThreshold is passed, this flag is set. It means that swiping is always shown.
  var swipeThresholdPassed = false;
  
  // The last measurement (of X-location) timestamp, used for calculating the swipe speed.
  var lastMeasurementTimestamp = 0;
  
  // The last measured swipe speed, in (x)-pixels per second. A negative number means a swipe to the left. Used to determine whether a swipe should be completed (compared to minspeed).
  var swipeSpeed = 0;
  
  // The container left, in pixels. This is a float value, and is necessary because the css('left') returns the pixels in a full value.
  var currentContainerX = 0;

  // Move to another item.
  this.move = function(offset, toggle) {
    switch (state) {
      case 'moving':
      case 'idle':
        // Set new currentItemIndex.
        currentItemIndex += offset;
        if (currentItemIndex < 0) {
          if (toggle) {
            currentItemIndex = items.length - 1;
          } else {
            currentItemIndex = 0;
          }
        } else if (currentItemIndex >= items.length) {
          if (toggle) {
            currentItemIndex = 0;
          } else {
            currentItemIndex = items.length - 1;
          }
        }
        
        $(this).trigger('moveitem', [items.get(currentItemIndex), currentItemIndex]);
        
        // Start moving.
        startMoving();
      
        break;
      default:
        // Ignore.
        break;
    }
  }

  // Move to a specified item.
  this.moveTo = function(index) {
    switch (state) {
      case 'moving':
      case 'idle':
        // Set new currentItemIndex.
        currentItemIndex = index;
        
        if (currentItemIndex < 0) {
          currentItemIndex = 0;
        } else if (currentItemIndex >= items.length) {
          currentItemIndex = items.length - 1;
        }

        $(this).trigger('moveitem', [items.get(currentItemIndex), currentItemIndex]);
        
        // Start moving.
        startMoving();
      
        break;
      default:
        // Ignore.
        break;
    }
  }
  
  // Mousedown event.
  $(this).bind((debug ? 'mousedown' : 'touchstart'), function(e) {
    switch (state) {
      case 'moving':
      case 'idle':
        state = 'swiping';
        
        startCurrentItemIndex = currentItemIndex;
        
        startX = (debug ? e.clientX : e.originalEvent.touches[0].clientX);
        currentX = startX;

        startY = (debug ? e.clientY : e.originalEvent.touches[0].clientY);
        startScrollPos = $(document).scrollTop();
        
        swipeThresholdPassed = false;
        
        lastMeasurementTimestamp = new Date().getTime();
        swipeSpeed = 0;

        if (debug) {
          // Prevent the default 'dragging' of Firefox images.
          (e.preventDefault ? e.preventDefault() : e.returnValue = false);
        }
        
        break;
      default:
        // Ignore.
        break;
    }
  });
  
  // Mousemove event.
  $(this).bind((debug ? 'mousemove' : 'touchmove'), function(e) {
    switch (state) {
      case 'swiping':
        // Get new mouse position.
        var newCurrentX = (debug ? e.clientX : e.originalEvent.touches[0].clientX);
        var newCurrentY = (debug ? e.clientY : e.originalEvent.touches[0].clientY);
        
        // Correct scrolling.
        $(document).scrollTop(startScrollPos - (newCurrentY - startY));
        
        // Calculate new speed.
        var newMeasurementTimestamp = new Date().getTime();
        swipeSpeed = (1000.0 * (newCurrentX - currentX)) / (newMeasurementTimestamp - lastMeasurementTimestamp);
        
        // Set measurements.
        currentX = newCurrentX;
        lastMeasurementTimestamp = newMeasurementTimestamp;
        
        // Show new position.
        if (swipeThresholdPassed || (Math.abs(startX - currentX) > swipeThreshold)) {
          var newX = $(items.get(startCurrentItemIndex)).position().left - (currentX - startX);
          $(container).css('left', -newX + 'px');
          swipeThresholdPassed = true;
          
          // If the user moves to another item manually, update the currentItemIndex.
          while ((currentItemIndex < items.length - 1) && $(items.get(currentItemIndex + 1)).position().left <= newX) {
            currentItemIndex++;
          }
          while ((currentItemIndex > 0) && $(items.get(currentItemIndex - 1)).position().left > newX) {
            currentItemIndex--;
          }
        }
        
        // Prevent the default 'dragging'.
        (e.preventDefault ? e.preventDefault() : e.returnValue = false);
        
        break;
      default:
        // Ignore.
        break;
    }
  });

  // Mouseup event.
  $(this).bind((debug ? 'mouseup' : 'touchend'), function(e) {
    switch (state) {
      case 'swiping':
        // End swiping.
        if (Math.abs(swipeSpeed) >= minspeed && (Math.abs(currentX - startX) >= mindistance)) {
          // Swipe speeds exceeds required speed. Complete swipe.
          if (swipeSpeed < 0) {
            // Swipe right.
            if (currentItemIndex < items.length - 1) {
              currentItemIndex++;
            }
            $(this).trigger('swipe', [1, currentItemIndex]);
          } else {
            // Swipe left.
            if (currentItemIndex > 0) {
              currentItemIndex--;
            }
            $(this).trigger('swipe', [0, currentItemIndex]);
          }
        }
        
        $(t).trigger('moveitem', [items.get(currentItemIndex), currentItemIndex]);
        
        startMoving();
        
        break;
      default:
        // Ignore.
        break;
    }
  });
  
  // Start moving.
  var startMoving = function() {
    // Get current left position.
    var matches = /^(\-?[\d\.]+)px$/.exec($(container).css('left'));
    currentContainerX = (matches ? -parseInt(matches[1]) : 0);
    
    // Start moving.
    state = 'moving';
    movingTimeout();
  }
  
  // Moving timeout event.
  var movingTimeout = function() {
    switch (state) {
      case 'moving':
        // Get target left.
        var targetLeft = $(items.get(currentItemIndex)).position().left;
        
        // Get current left.
        currentContainerX = currentContainerX + (targetLeft - currentContainerX) * moveFactor;
        var complete = false;
        if (Math.abs(targetLeft - currentContainerX) < 1.0) {
          complete = true;
          currentContainerX = targetLeft;
        }
        
        $(container).css('left', (-Math.round(currentContainerX)) + 'px');
        if (!complete) {
          setTimeout(function() {movingTimeout();}, 10);
        } else {
          $(t).trigger('changeitem', [items.get(currentItemIndex), currentItemIndex]);
          state = 'idle';
        }
        
        break;
      default:
        // Ignore.
        break;
    }
  }
  
  return this;
}

})(jQuery);