package com.pixel.data
{
   import flash.geom.Point;
   import flash.geom.Rectangle;
   
   public class ItemTransitionObject
   {
      
      public var introTransitionObj:TransitionObject;
      
      public var outroTransitionObj:TransitionObject;
      
      public var animating:Boolean = false;
      
      public var tweenDuration:int;
      
      public var useTimedPause:Boolean = true;
      
      public var pixelSize:int;
      
      public var currentTransitionObj:TransitionObject;
      
      public var pauseDuration:int;
      
      public var boundingRect:Rectangle;
      
      public var pixelSeparation:int;
      
      public var containerOffset:Point;
      
      public function ItemTransitionObject()
      {
         super();
      }
      
      public function debug() : void
      {
         introTransitionObj.debug();
         outroTransitionObj.debug();
      }
   }
}

