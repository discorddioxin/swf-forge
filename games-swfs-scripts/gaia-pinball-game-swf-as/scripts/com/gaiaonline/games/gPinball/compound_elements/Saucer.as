package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.NumberTools;
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   import flash.events.TimerEvent;
   import flash.geom.Point;
   import flash.utils.Timer;
   
   public class Saucer extends MovieClip
   {
      
      public var __SaucerFunction:Function;
      
      public var __SaucerType:String;
      
      public var __Active:Boolean = true;
      
      public var __PostEjectFunction:Function;
      
      public var __CoreFunc:Boolean;
      
      public var __FunctionString:String;
      
      public var __SaucerPointer:MovieClip;
      
      public var cup:MovieClip;
      
      public var __SaucerVis:Boolean = true;
      
      public var __SaucerTrigger:Trigger;
      
      public var __EjectSpeedMin:int;
      
      public var __LockObject:Ball;
      
      public var __EjectSpeedMax:int;
      
      public var __SndEffectEject:String = "none";
      
      public var __EjectLocation:String;
      
      public var __SndEffectLock:String = "none";
      
      public var __EjectDirection:MovieClip;
      
      public var __EjectInterval:int;
      
      public var __Location:String;
      
      public var __SID:int = 10;
      
      public var __FuncArgs:Array;
      
      public function Saucer()
      {
         super();
      }
      
      public function enterSaucer(param1:Ball, ... rest) : void
      {
         var _loc3_:Ball = null;
         if(__Active)
         {
            _loc3_ = param1;
            PinballCore.__Root.__HitQueue.push(__SID);
            if(__LockObject == null)
            {
               if(__SndEffectLock != "none")
               {
                  PinballCore.__Root.playSound(__SndEffectLock);
               }
               __LockObject = _loc3_;
               _loc3_.x = x;
               _loc3_.y = y;
               _loc3_.__Location = __Location;
               _loc3_.setActive(false);
               __SaucerFunction(_loc3_,this);
            }
         }
      }
      
      public function init() : void
      {
         PinballCore.__Table[name] = this;
         if(__CoreFunc)
         {
            __SaucerFunction = PinballCore.__Root[__FunctionString];
         }
         else
         {
            __SaucerFunction = parent[__FunctionString];
         }
         __LockObject = null;
         __SaucerTrigger.visible = false;
         __EjectDirection.visible = false;
         __SaucerPointer.visible = false;
         cup.visible = false;
         visible = __SaucerVis;
      }
      
      public function get active() : Boolean
      {
         return __Active;
      }
      
      public function setActive(param1:Boolean) : void
      {
         visible = false;
         if(param1)
         {
            cup.visible = __SaucerVis;
            visible = __SaucerVis;
         }
         __Active = param1;
         __SaucerTrigger.setActive(param1);
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Saucer]",param1);
      }
      
      public function set active(param1:Boolean) : void
      {
         __Active = param1;
      }
      
      public function eject(param1:TimerEvent) : void
      {
         var _loc2_:Saucer = null;
         var _loc3_:Number = NaN;
         var _loc4_:Point = null;
         var _loc5_:Point = null;
         var _loc6_:Timer = null;
         if(PinballCore.__Table == null || __LockObject == null || PinballCore.__Root == null)
         {
            return;
         }
         if(param1 != null)
         {
            if(param1.target != null)
            {
               _loc6_ = param1.target as Timer;
               if(_loc6_.hasEventListener("timer"))
               {
                  _loc6_.removeEventListener("timer",eject);
               }
            }
         }
         if(__EjectLocation == "this")
         {
            _loc2_ = this;
         }
         else
         {
            _loc2_ = PinballCore.__Table[__EjectLocation];
         }
         __LockObject.x = _loc2_.x;
         __LockObject.y = _loc2_.y;
         if(name == "launchSaucer")
         {
            dTrace("__LockObject (" + __LockObject.x + ", " + __LockObject.y + ")");
         }
         __LockObject.visible = true;
         if(__EjectSpeedMax > __EjectSpeedMin)
         {
            _loc3_ = NumberTools.getRandom(Math.abs(__EjectSpeedMin),Math.abs(__EjectSpeedMax),true);
         }
         else
         {
            _loc3_ = __EjectSpeedMin;
         }
         _loc4_ = new Point(0,0);
         _loc5_ = new Point(_loc2_.__EjectDirection.x,_loc2_.__EjectDirection.y);
         _loc4_ = _loc2_.localToGlobal(_loc4_);
         _loc5_ = _loc2_.localToGlobal(_loc5_);
         _loc5_ = _loc5_.subtract(_loc4_);
         _loc5_.normalize(_loc3_);
         if(__SndEffectEject != "none")
         {
            PinballCore.__Root.playSound(__SndEffectEject);
         }
         __LockObject.setVector(_loc5_.x,_loc5_.y);
         __LockObject.setActive(true);
         __LockObject = null;
      }
      
      public function ejectIn(param1:int) : void
      {
         var _loc2_:Timer = null;
         _loc2_ = new Timer(param1,1);
         _loc2_.addEventListener("timer",eject,false,0,true);
         _loc2_.start();
      }
   }
}

