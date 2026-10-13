package com.pixel.transitions
{
   import com.pixel.data.ItemTransitionObject;
   import com.pixel.data.TransitionObject;
   import com.pixel.events.TransitionEvent;
   import com.pixel.iterator.BaseIterator;
   import com.pixel.iterator.CompleteIterator;
   import com.pixel.transitions.explode.ExplodeTransitionOut;
   import com.pixel.util.BitmapDataAccessor;
   import flash.display.Bitmap;
   import flash.display.BitmapData;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.TimerEvent;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.system.System;
   import flash.utils.Timer;
   import flash.utils.setTimeout;
   
   public class ItemTransition extends EventDispatcher
   {
      
      private var __isIntro:Boolean;
      
      private var __drawBitmap:Bitmap;
      
      private var __transitionContainer:Sprite;
      
      private var __pixels:Array;
      
      private var __itmTransObj:ItemTransitionObject;
      
      private var __timer:Timer;
      
      private var __bAccessor:BitmapDataAccessor;
      
      private var __target:Sprite;
      
      private var __completedCtr:int;
      
      private var __drawBitmapData:BitmapData;
      
      public function ItemTransition(param1:Sprite, param2:Sprite, param3:ItemTransitionObject)
      {
         var _loc4_:Rectangle = null;
         super();
         __itmTransObj = param3;
         __transitionContainer = param2;
         __target = param1;
         __isIntro = true;
         if(Boolean(__transitionContainer) && Boolean(__transitionContainer.stage))
         {
            _loc4_ = getBoundingRect();
            trace(" \t 1 " + System.totalMemory / 1024 / 1024);
            __drawBitmapData = new BitmapData(_loc4_.width + _loc4_.x,_loc4_.height + _loc4_.y,true,16711935);
            __drawBitmap = new Bitmap(__drawBitmapData);
            __transitionContainer.addChild(__drawBitmap);
            if(__itmTransObj.introTransitionObj == null)
            {
               __itmTransObj.introTransitionObj = new TransitionObject();
            }
            if(__itmTransObj.outroTransitionObj == null)
            {
               __itmTransObj.outroTransitionObj = new TransitionObject();
               __itmTransObj.outroTransitionObj.transition = ExplodeTransitionOut;
            }
            __itmTransObj.boundingRect = _loc4_;
            __timer = new Timer(33);
            init();
            trace(" \t 6 " + System.totalMemory / 1024 / 1024);
         }
      }
      
      public function pause() : void
      {
         if(__timer.running)
         {
            __timer.stop();
            dispatchEvent(new TransitionEvent(TransitionEvent.TRANSITION_PAUSED));
         }
         else
         {
            __timer.start();
            dispatchEvent(new TransitionEvent(TransitionEvent.TRANSITION_UNPAUSED));
         }
      }
      
      public function set pixelSize(param1:int) : void
      {
         __itmTransObj.pixelSize = param1;
      }
      
      private function init() : void
      {
         var _loc1_:int = 0;
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:Number = NaN;
         var _loc5_:int = 0;
         var _loc6_:Boolean = false;
         _loc1_ = __itmTransObj.pixelSize;
         _loc2_ = __itmTransObj.pixelSeparation;
         trace("INIT!!!");
         trace(" \t 2 " + System.totalMemory / 1024 / 1024);
         if(__isIntro)
         {
            __bAccessor = new BitmapDataAccessor(null,__target);
            _loc5_ = _loc1_ == 1 ? 1 : 2;
            _loc6_ = !__itmTransObj.animating;
            __pixels = __bAccessor.generateTransitionPixels(_loc1_,_loc1_,_loc2_,_loc5_,_loc6_);
         }
         trace(" \t 3 " + System.totalMemory / 1024 / 1024 + " " + __pixels.length);
         __drawBitmap.x = __target.x - __target.x % (_loc1_ + _loc2_);
         __drawBitmap.y = __target.y - __target.y % (_loc1_ + _loc2_);
         __itmTransObj.currentTransitionObj = getCurrentTransitionObject();
         trace(" \t 4 " + System.totalMemory / 1024 / 1024);
         _loc3_ = int(__pixels.length);
         _loc4_ = 0;
         while(_loc4_ < _loc3_)
         {
            __pixels[_loc4_].transObject = __itmTransObj;
            __pixels[_loc4_].addEventListener(BaseTransition.PIXEL_TRANSITION_COMPLETE,transitionComplete,false,0,true);
            _loc4_++;
         }
         trace(" \t 5 " + System.totalMemory / 1024 / 1024);
      }
      
      private function getCurrentTransitionObject() : TransitionObject
      {
         if(__isIntro)
         {
            return __itmTransObj.introTransitionObj;
         }
         return __itmTransObj.outroTransitionObj;
      }
      
      public function start() : void
      {
         var transObj:TransitionObject = null;
         var Iterator:Class = null;
         var dur:Number = NaN;
         var frameTime:Number = NaN;
         var pixRoundedUp:Number = NaN;
         var numPerFrame:Number = NaN;
         var func:Function = null;
         var itr:BaseIterator = null;
         trace("ItemTransition.start() >> " + System.totalMemory / 1024 / 1024);
         if(__pixels)
         {
            if(!__isIntro)
            {
               init();
               dispatchEvent(new Event(TransitionEvent.PAUSE_COMPLETE));
            }
            transObj = getCurrentTransitionObject();
            Iterator = transObj.iterator;
            __completedCtr = 0;
            __target.visible = false;
            dur = Iterator == CompleteIterator ? transObj.tweenDuration : transObj.tweenDuration * 0.5;
            frameTime = 33;
            pixRoundedUp = __pixels.length + __pixels.length % 15;
            numPerFrame = Math.round(pixRoundedUp / (dur / frameTime));
            func = function():void
            {
               TransitionPixel(this).startTransition(dur);
            };
            itr = new Iterator(__pixels,func,frameTime,numPerFrame);
            itr.start();
            if(__isIntro || !__itmTransObj.animating)
            {
               __timer.addEventListener(TimerEvent.TIMER,run,false,0,true);
               __timer.start();
            }
         }
         trace("ItemTransition.start() FINISH >> " + System.totalMemory / 1024 / 1024);
      }
      
      private function clearBitmaps() : void
      {
         __drawBitmapData.dispose();
         __bAccessor.dispose();
         __transitionContainer.removeChild(__drawBitmap);
         __transitionContainer = null;
         __drawBitmapData = null;
         __drawBitmap = null;
      }
      
      public function clearPixels() : void
      {
         if(__timer == null)
         {
            return;
         }
         __timer.stop();
         __timer.removeEventListener(TimerEvent.TIMER,run);
         __timer = null;
         while(__pixels.length)
         {
            __pixels.pop();
         }
         __pixels = null;
         __itmTransObj = null;
         __target = null;
         clearBitmaps();
      }
      
      private function run(param1:Event = null) : void
      {
         var _loc2_:BitmapData = null;
         var _loc3_:BitmapData = null;
         var _loc4_:Point = null;
         var _loc5_:int = 0;
         var _loc6_:Number = NaN;
         var _loc7_:TransitionPixel = null;
         if(__pixels.length)
         {
            __drawBitmapData.fillRect(__drawBitmapData.rect,0);
            if(__itmTransObj.animating)
            {
               __bAccessor.updateBitmap(__target);
            }
            _loc2_ = new BitmapData(__pixels[0].currRect.width,__pixels[0].currRect.height);
            _loc3_ = __bAccessor.bitmap;
            _loc4_ = new Point();
            _loc5_ = int(__pixels.length);
            _loc6_ = 0;
            while(_loc6_ < _loc5_)
            {
               _loc7_ = __pixels[_loc6_];
               _loc7_.update();
               _loc4_.x = _loc7_.currRect.x;
               _loc4_.y = _loc7_.currRect.y;
               if(_loc7_.alpha != 1)
               {
                  _loc2_.fillRect(__drawBitmapData.rect,_loc7_.alpha * 255 << 24 | 0);
               }
               __drawBitmapData.copyPixels(_loc3_,_loc7_.initRect,_loc4_,_loc2_);
               _loc6_++;
            }
            _loc2_.dispose();
            _loc2_ = null;
            _loc3_ = null;
         }
      }
      
      public function get pixelSize() : int
      {
         return __itmTransObj.pixelSize;
      }
      
      private function getBoundingRect() : Rectangle
      {
         var _loc1_:int = 0;
         var _loc2_:int = 0;
         var _loc3_:Rectangle = null;
         _loc1_ = __itmTransObj.pixelSize;
         _loc2_ = __itmTransObj.pixelSeparation;
         if(Boolean(__transitionContainer) && Boolean(__transitionContainer.stage))
         {
            _loc3_ = new Rectangle(-__transitionContainer.x - (_loc1_ + _loc2_),-__transitionContainer.y - (_loc1_ + _loc2_),__transitionContainer.stage.stageWidth + (_loc1_ + _loc2_),__transitionContainer.stage.stageHeight + (_loc1_ + _loc2_));
         }
         else
         {
            _loc3_ = new Rectangle();
         }
         return _loc3_;
      }
      
      private function transitionComplete(param1:Event) : void
      {
         var _loc2_:TransitionPixel = null;
         ++__completedCtr;
         _loc2_ = TransitionPixel(param1.target);
         _loc2_.removeEventListener(BaseTransition.PIXEL_TRANSITION_COMPLETE,transitionComplete);
         if(__completedCtr == __pixels.length)
         {
            if(!__itmTransObj.animating)
            {
               __timer.stop();
            }
            run();
            if(__isIntro)
            {
               __isIntro = false;
               dispatchEvent(new TransitionEvent(TransitionEvent.INTRO_TRANSITION_COMPLETE));
               if(__itmTransObj.useTimedPause)
               {
                  setTimeout(start,__itmTransObj.pauseDuration);
               }
            }
            else
            {
               trace("-----------------------------------");
               trace("Resetting 1 >> " + System.totalMemory / 1024 / 1024);
               clearPixels();
               trace("Resetting 2 >> " + System.totalMemory / 1024 / 1024);
               dispatchEvent(new TransitionEvent(TransitionEvent.OUTRO_TRANSITION_COMPLETE));
               dispatchEvent(new TransitionEvent(TransitionEvent.TRANSITION_COMPLETE));
            }
         }
      }
      
      public function set pixelSeparation(param1:int) : void
      {
         __itmTransObj.pixelSeparation = param1;
      }
      
      public function get pixelSeparation() : int
      {
         return __itmTransObj.pixelSeparation;
      }
   }
}

