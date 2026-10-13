package com.pixel.transitions
{
   import com.pixel.data.SceneTransitionObject;
   import com.pixel.data.TransitionObject;
   import com.pixel.events.TransitionEvent;
   import com.pixel.iterator.BottomUpIterator;
   import com.pixel.iterator.CompleteIterator;
   import com.pixel.iterator.RandomIterator;
   import com.pixel.iterator.TopDownIterator;
   import com.pixel.transitions.explode.ExplodeTransitionIn;
   import com.pixel.transitions.explode.ExplodeTransitionOut;
   import com.pixel.transitions.fade.FadeTransitionIn;
   import com.pixel.transitions.fade.FadeTransitionOut;
   import com.pixel.transitions.scale.ScaleTransitionIn;
   import com.pixel.transitions.scale.ScaleTransitionOut;
   import com.pixel.transitions.wipe.WipeTransitionDownIn;
   import com.pixel.transitions.wipe.WipeTransitionDownOut;
   import com.pixel.transitions.wipe.WipeTransitionLeftIn;
   import com.pixel.transitions.wipe.WipeTransitionLeftOut;
   import com.pixel.transitions.wipe.WipeTransitionRightIn;
   import com.pixel.transitions.wipe.WipeTransitionRightOut;
   import com.pixel.transitions.wipe.WipeTransitionUpIn;
   import com.pixel.transitions.wipe.WipeTransitionUpOut;
   import fl.core.UIComponent;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.utils.getDefinitionByName;
   import flash.utils.getQualifiedClassName;
   
   public class TransitionComponent extends UIComponent
   {
      
      protected var __introDuration:int = 500;
      
      protected var __targetClip:MovieClip;
      
      protected var __pixelSeparation:int = 1;
      
      protected var __outroDuration:int = 500;
      
      protected var __introTransition:Class = ExplodeTransitionIn;
      
      protected var __introIterator:Class = RandomIterator;
      
      protected var __sceneTransition:SceneTransition;
      
      protected var __outroTransitionObject:TransitionObject;
      
      protected var __transitionHolder:MovieClip;
      
      protected var __target:String;
      
      protected var __sceneStartOffset:int = 500;
      
      public var mc:MovieClip;
      
      protected var __introTransitionObject:TransitionObject;
      
      protected var __animating:Boolean = false;
      
      protected var __outroIterator:Class = RandomIterator;
      
      protected var __pixelSize:int = 3;
      
      protected var __pauseDuration:int = 2000;
      
      public var running:Boolean;
      
      protected var __outroTransition:Class = ExplodeTransitionOut;
      
      public var imageHolder_mc:MovieClip;
      
      public function TransitionComponent()
      {
         super();
         importClasses();
         __transitionHolder = new MovieClip();
         addChild(__transitionHolder);
      }
      
      protected function resetTransition(param1:Event = null) : void
      {
         if(__sceneTransition)
         {
            __sceneTransition.clearPixels();
         }
      }
      
      public function set introIterator(param1:String) : void
      {
         var _loc2_:String = null;
         _loc2_ = "com.pixel.iterator." + param1;
         __introIterator = getDefinitionByName(_loc2_) as Class;
      }
      
      public function get introDuration() : Number
      {
         return __introDuration;
      }
      
      public function set outroTransitionObject(param1:TransitionObject) : void
      {
         __outroTransitionObject = param1;
      }
      
      public function start() : void
      {
         running = true;
         refreshTransition();
         __sceneTransition.start();
      }
      
      public function get pixelSeparation() : Number
      {
         return __pixelSeparation;
      }
      
      public function set introDuration(param1:Number) : void
      {
         __introDuration = param1;
      }
      
      protected function refreshTransition(param1:Event = null) : void
      {
         var _loc2_:Class = null;
         resetTransition();
         if(!__targetClip)
         {
            _loc2_ = getDefinitionByName("DemoClip") as Class;
            __targetClip = new _loc2_();
         }
         __sceneTransition = new SceneTransition(__targetClip,__transitionHolder,getSceneTransitionObject());
         __sceneTransition.addEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,transitionComplete,false,0,true);
      }
      
      public function set image(param1:String) : void
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
            imageHolder_mc.addChild(__targetClip);
         }
      }
      
      public function get outroDuration() : Number
      {
         return __outroDuration;
      }
      
      protected function importClasses() : void
      {
         var _loc1_:* = undefined;
         _loc1_ = BottomUpIterator;
         _loc1_ = RandomIterator;
         _loc1_ = TopDownIterator;
         _loc1_ = CompleteIterator;
         _loc1_ = ExplodeTransitionIn;
         _loc1_ = ExplodeTransitionOut;
         _loc1_ = FadeTransitionIn;
         _loc1_ = FadeTransitionOut;
         _loc1_ = ScaleTransitionIn;
         _loc1_ = ScaleTransitionOut;
         _loc1_ = WipeTransitionDownIn;
         _loc1_ = WipeTransitionDownOut;
         _loc1_ = WipeTransitionLeftIn;
         _loc1_ = WipeTransitionLeftOut;
         _loc1_ = WipeTransitionRightIn;
         _loc1_ = WipeTransitionRightOut;
         _loc1_ = WipeTransitionUpIn;
         _loc1_ = WipeTransitionUpOut;
      }
      
      public function set animating(param1:Boolean) : void
      {
         __animating = param1;
      }
      
      public function set sceneStartOffset(param1:Number) : void
      {
         __sceneStartOffset = param1;
      }
      
      public function get introTransition() : String
      {
         return getQualifiedClassName(__introTransition);
      }
      
      public function set pixelSeparation(param1:Number) : void
      {
         __pixelSeparation = param1;
      }
      
      public function get introIterator() : String
      {
         return getQualifiedClassName(__introIterator);
      }
      
      public function set introTransitionObject(param1:TransitionObject) : void
      {
         __introTransitionObject = param1;
      }
      
      public function get outroTransitionObject() : TransitionObject
      {
         return __outroTransitionObject;
      }
      
      public function set outroIterator(param1:String) : void
      {
         __outroIterator = getDefinitionByName("com.pixel.iterator." + param1) as Class;
      }
      
      override protected function draw() : void
      {
      }
      
      public function set pauseDuration(param1:Number) : void
      {
         __pauseDuration = param1;
      }
      
      public function set pixelSize(param1:Number) : void
      {
         __pixelSize = param1;
      }
      
      public function get image() : String
      {
         return __target;
      }
      
      public function get animating() : Boolean
      {
         return __animating;
      }
      
      public function get sceneStartOffset() : Number
      {
         return __sceneStartOffset;
      }
      
      public function set outroTransition(param1:String) : void
      {
         __outroTransition = getFullyQualifiedName(param1);
      }
      
      public function get introTransitionObject() : TransitionObject
      {
         return __introTransitionObject;
      }
      
      public function get outroIterator() : String
      {
         return getQualifiedClassName(__outroIterator);
      }
      
      protected function getFullyQualifiedName(param1:String) : Class
      {
         var arr:Array = null;
         var i:Number = NaN;
         var str:String = null;
         var name:Class = null;
         var className:String = param1;
         arr = getTransitionPackageArr();
         i = 0;
         while(i < arr.length)
         {
            str = arr[i] + className;
            try
            {
               name = getDefinitionByName(str) as Class;
               if(name != null)
               {
                  return name;
               }
            }
            catch(e:Error)
            {
            }
            i++;
         }
         return null;
      }
      
      public function get pauseDuration() : Number
      {
         return __pauseDuration;
      }
      
      public function get pixelSize() : Number
      {
         return __pixelSize;
      }
      
      public function set introTransition(param1:String) : void
      {
         __introTransition = getFullyQualifiedName(param1);
      }
      
      public function get outroTransition() : String
      {
         return getQualifiedClassName(__outroTransition);
      }
      
      protected function transitionComplete(param1:Event = null) : void
      {
         var _loc2_:TransitionEvent = null;
         resetTransition();
         if(__sceneTransition.hasEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE))
         {
            __sceneTransition.removeEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,transitionComplete);
         }
         _loc2_ = new TransitionEvent(TransitionEvent.SCENE_TRANSITION_COMPLETE);
         if(__target)
         {
            _loc2_.transitionId = __target;
         }
         running = false;
         dispatchEvent(_loc2_);
      }
      
      public function set outroDuration(param1:Number) : void
      {
         __outroDuration = param1;
      }
      
      protected function getTransitionPackageArr() : Array
      {
         return ["com.pixel.transitions.explode.","com.pixel.transitions.fade.","com.pixel.transitions.scale.","com.pixel.transitions.wipe."];
      }
      
      protected function getSceneTransitionObject() : SceneTransitionObject
      {
         var _loc1_:TransitionObject = null;
         var _loc2_:TransitionObject = null;
         var _loc3_:SceneTransitionObject = null;
         _loc1_ = new TransitionObject();
         _loc1_.transition = __introTransition;
         _loc1_.iterator = __introIterator;
         _loc1_.tweenDuration = __introDuration;
         _loc2_ = new TransitionObject();
         _loc2_.transition = __outroTransition;
         _loc2_.iterator = __outroIterator;
         _loc2_.tweenDuration = __outroDuration;
         _loc3_ = new SceneTransitionObject();
         _loc3_.introTransitionObj = _loc1_;
         _loc3_.outroTransitionObj = _loc2_;
         _loc3_.pauseDuration = __pauseDuration;
         _loc3_.transitionOffset = __sceneStartOffset;
         _loc3_.tweenDuration = 5000;
         _loc3_.pixelSeparation = __pixelSeparation;
         _loc3_.pixelSize = __pixelSize;
         _loc3_.animating = __animating;
         return _loc3_;
      }
   }
}

