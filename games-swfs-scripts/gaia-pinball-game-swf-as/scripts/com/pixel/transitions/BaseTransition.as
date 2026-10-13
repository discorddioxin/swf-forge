package com.pixel.transitions
{
   import com.pixel.transitions.explode.ExplodeTransitionIn;
   import com.pixel.transitions.explode.ExplodeTransitionOut;
   import com.pixel.transitions.wipe.WipeTransitionDownIn;
   import com.pixel.transitions.wipe.WipeTransitionDownOut;
   import com.pixel.transitions.wipe.WipeTransitionLeftIn;
   import com.pixel.transitions.wipe.WipeTransitionLeftOut;
   import com.pixel.transitions.wipe.WipeTransitionRightIn;
   import com.pixel.transitions.wipe.WipeTransitionRightOut;
   import com.pixel.transitions.wipe.WipeTransitionUpIn;
   import com.pixel.transitions.wipe.WipeTransitionUpOut;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.IEventDispatcher;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   
   public class BaseTransition extends EventDispatcher
   {
      
      public static const PIXEL_TRANSITION_COMPLETE:String = "pixelTransitionComplete";
      
      public static const TRANSITION_BEGUN:String = "transitionBegun";
      
      protected var __boundingRect:Rectangle;
      
      protected var __elapsedTime:Number = 0;
      
      protected var __endPt:Point;
      
      protected var __lastTime:Number = 0;
      
      protected var __completePerc:Number = 0;
      
      protected var __easeType:String;
      
      protected var __target:TransitionPixel;
      
      public function BaseTransition(param1:String = "linear", param2:IEventDispatcher = null)
      {
         __elapsedTime = 0;
         __easeType = param1;
         super(param2);
      }
      
      public static function getRandomTransitionOut() : Class
      {
         var _loc1_:Array = null;
         _loc1_ = [ExplodeTransitionOut,WipeTransitionRightOut,WipeTransitionDownOut,WipeTransitionLeftOut,WipeTransitionUpOut];
         return _loc1_[Math.floor(Math.random() * _loc1_.length)];
      }
      
      public static function getRandomTransitionIn() : Class
      {
         var _loc1_:Array = null;
         _loc1_ = [ExplodeTransitionIn,WipeTransitionLeftIn,WipeTransitionUpIn,WipeTransitionRightIn,WipeTransitionDownIn];
         return _loc1_[Math.floor(Math.random() * _loc1_.length)];
      }
      
      public static function getRandomTransition() : Class
      {
         var _loc1_:Array = null;
         _loc1_ = [ExplodeTransitionIn,ExplodeTransitionOut,WipeTransitionLeftIn,WipeTransitionRightOut,WipeTransitionUpIn,WipeTransitionDownOut,WipeTransitionRightIn,WipeTransitionLeftOut,WipeTransitionDownIn,WipeTransitionUpOut];
         return _loc1_[Math.floor(Math.random() * _loc1_.length)];
      }
      
      public function start(param1:int = 1000) : void
      {
      }
      
      protected function transitionComplete() : void
      {
         dispatchEvent(new Event(PIXEL_TRANSITION_COMPLETE));
      }
      
      public function init(param1:TransitionPixel) : void
      {
         __target = param1;
      }
      
      public function set boundingRect(param1:Rectangle) : void
      {
         __boundingRect = param1;
      }
   }
}

