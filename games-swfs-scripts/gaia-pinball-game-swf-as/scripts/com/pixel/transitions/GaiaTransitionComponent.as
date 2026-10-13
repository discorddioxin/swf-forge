package com.pixel.transitions
{
   import com.gaiaonline.games.gPinball.compound_elements.SlotMachine;
   import com.pixel.data.SceneTransitionObject;
   import com.pixel.events.TransitionEvent;
   import com.pixel.motion.TweenTypes;
   import com.pixel.motion.Tweener;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.system.System;
   import flash.utils.clearTimeout;
   import flash.utils.getDefinitionByName;
   import flash.utils.setTimeout;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol897")]
   public class GaiaTransitionComponent extends TransitionComponent
   {
      
      private var __CompleteHandler:uint;
      
      public function GaiaTransitionComponent()
      {
         super();
      }
      
      public function forceTransitionComplete() : void
      {
         transitionComplete();
      }
      
      private function pauseOutroComplete() : void
      {
         __sceneTransition.pause();
         __sceneTransition.manuallyPlayOutro();
      }
      
      override public function start() : void
      {
         running = true;
         if(__targetClip is SlotMachine)
         {
            __targetClip.start();
         }
         else
         {
            if(!__targetClip.dialog)
            {
               __targetClip.dialog = new MovieClip();
            }
            if(__introDuration == 0 && __outroDuration == 0)
            {
               __targetClip.transitioner.visible = true;
               __targetClip.dialog.visible = true;
               __CompleteHandler = setTimeout(transitionComplete,__pauseDuration);
            }
            else
            {
               trace(" 1 >>: " + System.totalMemory / 1024 / 1024);
               trace("Refreshing...");
               refreshTransition();
               trace(" 2 >>: " + System.totalMemory / 1024 / 1024);
               trace("Starting...");
               __sceneTransition.start();
            }
         }
      }
      
      override protected function refreshTransition(param1:Event = null) : void
      {
         resetTransition();
         __targetClip.dialog.visible = false;
         if(!__targetClip.transitioner)
         {
            throw new Error("transitioner movieclip does not exist inside target!!");
         }
         __sceneTransition = new SceneTransition(__targetClip.transitioner,__transitionHolder,getSceneTransitionObject());
         __sceneTransition.addEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,transitionComplete,false,0,true);
         __sceneTransition.addEventListener(TransitionEvent.PAUSE_BEGUN,playBubble,false,0,true);
      }
      
      override public function set image(param1:String) : void
      {
         var _loc2_:Class = null;
         var _loc3_:MovieClip = null;
         if(param1)
         {
            __target = param1;
            _loc2_ = getDefinitionByName(param1) as Class;
            _loc3_ = new _loc2_();
            if(__targetClip != null && Boolean(__targetClip.parent))
            {
               imageHolder_mc.removeChild(__targetClip);
            }
            __targetClip = _loc3_;
            if(__targetClip.transitioner != null)
            {
               __targetClip.transitioner.visible = false;
               __targetClip.addChild(__transitionHolder);
            }
            if(__targetClip.dialog)
            {
               __targetClip.dialog.visible = false;
            }
            imageHolder_mc.addChild(__targetClip);
         }
      }
      
      public function transitionAbort() : void
      {
         clearTimeout(__CompleteHandler);
         trace("ABORTING Transition");
         resetTransition();
         if(__targetClip)
         {
            if(__targetClip.parent)
            {
               try
               {
                  __targetClip.removeChild(__targetClip.dialog);
               }
               catch(e:*)
               {
               }
            }
            __targetClip.parent.removeChild(__targetClip);
         }
         if(__sceneTransition)
         {
            __sceneTransition.removeEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,transitionComplete);
         }
         __sceneTransition = null;
         running = false;
      }
      
      private function playBubble(param1:TransitionEvent) : void
      {
         var dialog:MovieClip = null;
         var evt:TransitionEvent = param1;
         __sceneTransition.removeEventListener(TransitionEvent.PAUSE_BEGUN,playBubble);
         __sceneTransition.pause();
         dialog = MovieClip(__targetClip.dialog);
         if(dialog)
         {
            try
            {
               __targetClip.setChildIndex(__targetClip.dialog,__targetClip.numChildren - 1);
            }
            catch(e:Error)
            {
            }
            dialog.visible = true;
            dialog.scaleX = dialog.scaleY = 0;
            Tweener.addTween(dialog,{
               "scaleX":1,
               "scaleY":1,
               "time":0.5,
               "transition":TweenTypes.EASE_OUT_CUBIC,
               "onComplete":pauseIntroComplete
            });
         }
      }
      
      private function executePauseOutro() : void
      {
         var _loc1_:MovieClip = null;
         _loc1_ = MovieClip(__targetClip.dialog);
         Tweener.addTween(_loc1_,{
            "scaleX":0,
            "scaleY":0,
            "time":0.5,
            "transition":TweenTypes.EASE_OUT_CUBIC,
            "onComplete":pauseOutroComplete
         });
      }
      
      private function pauseIntroComplete() : void
      {
         setTimeout(executePauseOutro,__pauseDuration);
      }
      
      override protected function transitionComplete(param1:Event = null) : void
      {
         var evt:TransitionEvent = null;
         var e:Event = param1;
         resetTransition();
         if(__targetClip.parent)
         {
            try
            {
               __targetClip.removeChild(__targetClip.dialog);
            }
            catch(e:*)
            {
            }
            __targetClip.parent.removeChild(__targetClip);
         }
         if(__sceneTransition)
         {
            __sceneTransition.removeEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,transitionComplete);
         }
         __sceneTransition = null;
         evt = new TransitionEvent(TransitionEvent.SCENE_TRANSITION_COMPLETE);
         evt.transitionId = __target;
         running = false;
         dispatchEvent(evt);
      }
      
      override protected function getSceneTransitionObject() : SceneTransitionObject
      {
         var _loc1_:SceneTransitionObject = null;
         _loc1_ = super.getSceneTransitionObject();
         _loc1_.useTimedPause = false;
         return _loc1_;
      }
   }
}

