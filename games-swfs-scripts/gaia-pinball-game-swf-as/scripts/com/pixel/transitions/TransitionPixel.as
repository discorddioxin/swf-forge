package com.pixel.transitions
{
   import com.pixel.data.ItemTransitionObject;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   
   public class TransitionPixel extends EventDispatcher
   {
      
      private var __alpha:Number = 1;
      
      private var __xScale:Number = 1;
      
      private var __currRect:Rectangle;
      
      private var __x:Number = 0;
      
      private var __y:Number = 0;
      
      private var __transObject:ItemTransitionObject;
      
      private var __yScale:Number = 1;
      
      private var __transition:BaseTransition;
      
      private var __xP:Number = 0;
      
      private var PIXEL_SIZE:int = 3;
      
      private var PIXEL_SEPARATION:int = 1;
      
      private var __yP:Number = 0;
      
      private var __offset:Point;
      
      private var __initRect:Rectangle;
      
      public function TransitionPixel()
      {
         super();
         __offset = new Point(0,0);
      }
      
      public function set currRect(param1:Rectangle) : void
      {
         __currRect = param1;
      }
      
      public function get transObject() : ItemTransitionObject
      {
         return __transObject;
      }
      
      public function get initRect() : Rectangle
      {
         return __initRect;
      }
      
      public function set transObject(param1:ItemTransitionObject) : void
      {
         var _loc2_:Class = null;
         __transObject = param1;
         _loc2_ = __transObject.currentTransitionObj.transition;
         PIXEL_SIZE = __transObject.pixelSize;
         PIXEL_SEPARATION = __transObject.pixelSeparation;
         __offset = __transObject.containerOffset;
         __transition = new _loc2_(__transObject.currentTransitionObj.easeType) as BaseTransition;
         __transition.boundingRect = __transObject.boundingRect;
         __transition.init(this);
      }
      
      public function set scaleX(param1:Number) : void
      {
      }
      
      public function set scaleY(param1:Number) : void
      {
      }
      
      public function dispose() : void
      {
         __transition = null;
         __initRect = null;
         __currRect = null;
         __offset = null;
         __transObject = null;
      }
      
      public function set yS(param1:Number) : void
      {
         __yScale = param1;
      }
      
      public function set initRect(param1:Rectangle) : void
      {
         __initRect = param1;
         __xP = __x = __initRect.x;
         __yP = __y = __initRect.y;
         update();
      }
      
      public function get currRect() : Rectangle
      {
         return __currRect;
      }
      
      public function set xP(param1:Number) : void
      {
         __x = param1;
      }
      
      public function set alpha(param1:Number) : void
      {
         __alpha = param1;
      }
      
      public function get yP() : Number
      {
         return __y;
      }
      
      public function set xS(param1:Number) : void
      {
         __xScale = param1;
      }
      
      public function update() : void
      {
         __xP = __x - __x % (PIXEL_SIZE + PIXEL_SEPARATION) + __offset.x;
         __yP = __y - __y % (PIXEL_SIZE + PIXEL_SEPARATION) + __offset.y;
         __currRect = new Rectangle(__xP,__yP,PIXEL_SIZE,PIXEL_SIZE);
      }
      
      public function get scaleY() : Number
      {
         return 0;
      }
      
      public function get scaleX() : Number
      {
         return 0;
      }
      
      public function get xP() : Number
      {
         return __x;
      }
      
      public function get xS() : Number
      {
         return __xScale;
      }
      
      public function startTransition(param1:int) : void
      {
         __transition.addEventListener(BaseTransition.PIXEL_TRANSITION_COMPLETE,onTransitionComplete,false,0,true);
         __transition.start(param1);
      }
      
      public function get alpha() : Number
      {
         return __alpha;
      }
      
      private function onTransitionComplete(param1:Event) : void
      {
         stopTransition();
         dispatchEvent(new Event(BaseTransition.PIXEL_TRANSITION_COMPLETE));
      }
      
      public function set yP(param1:Number) : void
      {
         __y = param1;
      }
      
      public function stopTransition(param1:Event = null) : void
      {
         __transition.removeEventListener(BaseTransition.PIXEL_TRANSITION_COMPLETE,onTransitionComplete);
      }
      
      public function get yS() : Number
      {
         return __yScale;
      }
   }
}

