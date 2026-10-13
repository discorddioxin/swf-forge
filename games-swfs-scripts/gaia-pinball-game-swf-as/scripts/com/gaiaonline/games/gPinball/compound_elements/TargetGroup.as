package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.utils.*;
   
   public class TargetGroup extends MovieClip
   {
      
      public var __PopAudio:String = "none";
      
      public var breakthrough:Obstacle;
      
      private var __PopupTimer:Timer;
      
      public var __TotalTargets:int;
      
      public var __AutoPop:Boolean;
      
      public var __GroupLevel:int;
      
      public var __GroupTargetType:String;
      
      public var __MaxLevel:int;
      
      public var __CompFunc:Function;
      
      public var __PopupTime:int = 250;
      
      public var __MaxDrops:int;
      
      public var __Location:String = "table";
      
      private var __MyTargets:Array;
      
      public var __CompFuncStr:String;
      
      public var target2:Target;
      
      public var target3:Target;
      
      public var target4:Target;
      
      public var target6:Target;
      
      public var target7:Target;
      
      public var target0:Target;
      
      public var __GroupCount:int;
      
      public var __GroupQueue:String;
      
      public var target5:Target;
      
      public var target8:Target;
      
      public var __GroupScoreLink:String;
      
      public var __HitTargets:int;
      
      public var target1:Target;
      
      private var __BreakthroughTimer:Timer;
      
      public function TargetGroup()
      {
         super();
         __BreakthroughTimer = new Timer(250,1);
         __PopupTimer = new Timer(__PopupTime,1);
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function unListen() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         _loc1_ = 0;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Target)
            {
               _loc2_.removeEventListener("targetHit",tallyTargets);
            }
            _loc1_++;
         }
      }
      
      public function tallyTargets(param1:Event) : void
      {
         var _loc2_:Target = null;
         _loc2_ = param1.target as Target;
         PinballCore.__Root.playSpark(name + "_" + _loc2_.name);
         __HitTargets |= (param1.target as Target).id;
         if(__HitTargets == __TotalTargets)
         {
            __HitTargets = 0;
            ++__GroupCount;
            if(!(__GroupCount >= __MaxDrops && __MaxDrops != 0))
            {
               if(__AutoPop)
               {
                  popAll();
               }
            }
            __CompFunc();
         }
      }
      
      public function init(param1:Event) : void
      {
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:DisplayObject = null;
         var _loc5_:Target = null;
         removeEventListener("enterFrame",init);
         if(param1.target == this)
         {
            if(breakthrough != null)
            {
               breakthrough.init(PinballCore.__Table.default_obst_decay,0,"table",null,0);
            }
            __MyTargets = new Array();
            PinballCore.__Table[name] = this;
            _loc2_ = 0;
            _loc3_ = 0;
            __TotalTargets = 0;
            __HitTargets = 0;
            __GroupCount = 0;
            __GroupLevel = 1;
            _loc2_ = 0;
            while(_loc2_ < numChildren)
            {
               _loc4_ = getChildAt(_loc2_);
               if(_loc4_ is Target)
               {
                  _loc5_ = _loc4_ as Target;
                  _loc5_.init();
                  _loc5_.setID(Math.pow(2,_loc3_));
                  _loc5_.__ScoreLink = __GroupScoreLink;
                  _loc5_.__ScoreMult = __GroupLevel;
                  _loc5_.__GroupQueue = __GroupQueue;
                  if(__GroupTargetType != "multi")
                  {
                     _loc5_.__TargetType = __GroupTargetType;
                  }
                  _loc3_ += 1;
                  _loc4_.removeEventListener("targetHit",tallyTargets);
                  _loc4_.addEventListener("targetHit",tallyTargets,false,0,true);
                  __MyTargets.push(_loc5_);
               }
               _loc2_++;
            }
            __TotalTargets = Math.pow(2,_loc3_) - 1;
            __CompFunc = PinballCore.__Root[__CompFuncStr];
         }
      }
      
      public function closeBreakthrough() : void
      {
         if(__BreakthroughTimer.hasEventListener("timer"))
         {
            __BreakthroughTimer.removeEventListener("timer",doOpen);
         }
         if(__BreakthroughTimer.running)
         {
            __BreakthroughTimer.reset();
         }
         if(breakthrough != null)
         {
            breakthrough.active = true;
         }
      }
      
      public function levelUp() : void
      {
         var _loc1_:int = 0;
         if(!maxLevelReached())
         {
            _loc1_ = 0;
            while(_loc1_ < __MyTargets.length)
            {
               __MyTargets[_loc1_].levelUp();
               _loc1_++;
            }
            __HitTargets = 0;
            ++__GroupLevel;
            __GroupCount = 0;
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Target Group]",param1);
      }
      
      public function openBreakthrough() : void
      {
         __BreakthroughTimer.addEventListener("timer",doOpen,false,0,true);
         __BreakthroughTimer.start();
      }
      
      public function resetGroup() : void
      {
         __GroupCount = 0;
         popAll();
      }
      
      public function doOpen(param1:TimerEvent) : void
      {
         __BreakthroughTimer.removeEventListener("timer",doOpen);
         if(breakthrough != null)
         {
            breakthrough.active = false;
         }
      }
      
      public function popAll() : void
      {
         __PopupTimer.addEventListener("timer",doPop,false,0,true);
         __PopupTimer.start();
      }
      
      public function forceHit() : void
      {
         var _loc1_:int = 0;
         _loc1_ = 0;
         while(_loc1_ < __MyTargets.length)
         {
            __MyTargets[_loc1_].hitTarget();
            _loc1_++;
         }
         __HitTargets = __TotalTargets;
      }
      
      public function resetLevel() : void
      {
         var _loc1_:int = 0;
         _loc1_ = 0;
         while(_loc1_ < __MyTargets.length)
         {
            __MyTargets[_loc1_].resetLevel();
            _loc1_++;
         }
         __HitTargets = 0;
         __GroupLevel = 1;
         __GroupCount = 0;
         closeBreakthrough();
      }
      
      public function maxLevelReached() : Boolean
      {
         return __GroupLevel >= __MaxLevel;
      }
      
      public function doPop(param1:TimerEvent) : void
      {
         var _loc2_:int = 0;
         if(__PopAudio != "none")
         {
            PinballCore.__Root.playSound(__PopAudio);
         }
         __PopupTimer.removeEventListener("timer",doOpen);
         __PopupTimer.reset();
         _loc2_ = 0;
         while(_loc2_ < __MyTargets.length)
         {
            __MyTargets[_loc2_].reset();
            _loc2_++;
         }
         __HitTargets = 0;
      }
      
      public function resetAll() : void
      {
         if(__PopupTimer.running)
         {
            __PopupTimer.reset();
         }
         if(__PopupTimer.hasEventListener("timer"))
         {
            __PopupTimer.removeEventListener("timer",doPop);
         }
         resetLevel();
      }
   }
}

