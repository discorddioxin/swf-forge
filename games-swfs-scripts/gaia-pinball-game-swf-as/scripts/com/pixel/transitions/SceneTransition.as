package com.pixel.transitions
{
   import com.pixel.data.ItemTransitionObject;
   import com.pixel.data.SceneTransitionObject;
   import com.pixel.events.TransitionEvent;
   import com.pixel.iterator.BaseIterator;
   import com.pixel.iterator.TopDownIterator;
   import com.pixel.motion.Tweener;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.geom.Point;
   
   public class SceneTransition extends EventDispatcher
   {
      
      private var __sceneTransObject:SceneTransitionObject;
      
      private var __transitionsCompleted:int = 0;
      
      private var __paused:Boolean = false;
      
      private var __managers:Array;
      
      private var __container:MovieClip;
      
      private var __pauseIncsCompleted:int = 0;
      
      private var __target:MovieClip;
      
      public function SceneTransition(param1:MovieClip, param2:MovieClip, param3:SceneTransitionObject)
      {
         var _loc4_:ItemTransitionObject = null;
         var _loc5_:int = 0;
         var _loc6_:Number = NaN;
         var _loc7_:Object = null;
         var _loc8_:Sprite = null;
         var _loc9_:ItemTransition = null;
         __transitionsCompleted = 0;
         __pauseIncsCompleted = 0;
         __paused = false;
         super();
         __sceneTransObject = param3;
         __target = param1;
         __container = param2;
         __managers = new Array();
         _loc4_ = ItemTransitionObject(__sceneTransObject);
         _loc4_.containerOffset = new Point(__target.x,__target.y);
         _loc5_ = __target.numChildren;
         _loc6_ = 0;
         while(_loc6_ < _loc5_)
         {
            _loc7_ = __target.getChildAt(_loc6_);
            if(_loc7_ is Sprite)
            {
               _loc8_ = Sprite(_loc7_);
               _loc9_ = new ItemTransition(_loc8_,__container,_loc4_);
               trace("-----------------------------------");
               _loc9_.addEventListener(TransitionEvent.TRANSITION_COMPLETE,incrementComplete,false,0,true);
               _loc9_.addEventListener(TransitionEvent.INTRO_TRANSITION_COMPLETE,introIncrementComplete,false,0,true);
               __managers.push(_loc9_);
            }
            _loc6_++;
         }
      }
      
      private function incrementComplete(param1:Event) : void
      {
         ItemTransition(param1.target).removeEventListener(TransitionEvent.TRANSITION_COMPLETE,incrementComplete);
         ++__transitionsCompleted;
         trace("======== Completed:" + __transitionsCompleted + " ========= ");
         if(__transitionsCompleted == __managers.length)
         {
            dispatchEvent(new TransitionEvent(TransitionEvent.SCENE_TRANSITION_COMPLETE));
         }
      }
      
      public function manuallyPlayOutro() : void
      {
         var func:Function = null;
         var itr:BaseIterator = null;
         func = function():void
         {
            ItemTransition(this).start();
         };
         itr = new TopDownIterator(__managers,func,__sceneTransObject.transitionOffset);
         itr.start();
      }
      
      public function clearPixels() : void
      {
         var _loc1_:Number = NaN;
         var _loc2_:ItemTransition = null;
         _loc1_ = 0;
         while(_loc1_ < __managers.length)
         {
            _loc2_ = __managers[_loc1_];
            _loc2_.clearPixels();
            trace("-----------------------------------");
            _loc1_++;
         }
         while(__managers.length)
         {
            __managers.pop();
         }
         __sceneTransObject = null;
      }
      
      public function start() : void
      {
         var func:Function = null;
         var itr:BaseIterator = null;
         trace("Starting scene transition");
         __transitionsCompleted = 0;
         func = function():void
         {
            ItemTransition(this).start();
         };
         itr = new TopDownIterator(__managers,func,__sceneTransObject.transitionOffset);
         itr.start();
      }
      
      private function introIncrementComplete(param1:Event) : void
      {
         ++__pauseIncsCompleted;
         if(__pauseIncsCompleted == __managers.length)
         {
            dispatchEvent(new TransitionEvent(TransitionEvent.PAUSE_BEGUN));
         }
      }
      
      public function pause() : void
      {
         var _loc1_:Number = NaN;
         var _loc2_:ItemTransition = null;
         __paused = !__paused;
         if(__paused)
         {
            Tweener.pauseAllTweens();
         }
         else
         {
            Tweener.resumeAllTweens();
         }
         _loc1_ = 0;
         while(_loc1_ < __managers.length)
         {
            _loc2_ = __managers[_loc1_];
            _loc2_.pause();
            _loc1_++;
         }
      }
   }
}

