package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.*;
   
   public class Target extends MovieClip
   {
      
      public var __Power:Number = 3;
      
      public var __Active:Boolean = true;
      
      public var __LightLevel:int = 1;
      
      public var targetArt:MovieClip;
      
      public var ring:MovieClip;
      
      public var targetLight:MovieClip;
      
      public var __SndEffectUnhit:String = "none";
      
      public var __TargetType:String;
      
      public var __SndEffectLevel:Boolean = false;
      
      public var __TargetID:int;
      
      public var __Location:String = "table";
      
      public var __Decay:Number = PinballCore.__Table.default_obst_decay;
      
      public var __ScoreLink:String = "genericTarget";
      
      public var __SID:int = 10;
      
      public var __GroupQueue:String;
      
      public var __DropLevel:int = 1;
      
      public var __SndEffectHit:String = "none";
      
      public var __ScoreMult:Number;
      
      public var targetObstacle:MovieClip;
      
      public function Target()
      {
         super();
      }
      
      public function setID(param1:int) : void
      {
         __TargetID = param1;
      }
      
      public function activate() : void
      {
         var _loc1_:uint = 0;
         var _loc2_:DisplayObject = null;
         __Active = true;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Obstacle)
            {
               (_loc2_ as Obstacle).active = true;
            }
            _loc1_++;
         }
      }
      
      public function init(... rest) : void
      {
         var _loc2_:uint = 0;
         var _loc3_:DisplayObject = null;
         if(__Location == "useParent")
         {
            __Location = (parent as MovieClip).__Location;
         }
         _loc2_ = 0;
         while(_loc2_ < numChildren)
         {
            _loc3_ = getChildAt(_loc2_);
            if(_loc3_ is Obstacle)
            {
               (_loc3_ as Obstacle).init(__Decay,__Power,__Location,hitTarget,0);
            }
            _loc2_++;
         }
         if(ring != null)
         {
            ring.rotation = -parent.rotation;
         }
         if(targetLight != null)
         {
            targetLight.rotation = -parent.rotation;
         }
         refresh();
      }
      
      public function activateLight(param1:Boolean) : void
      {
         if(param1)
         {
            targetLight.gotoAndStop("ON");
         }
         else
         {
            targetLight.gotoAndStop("OFF");
         }
      }
      
      public function dropTargetArt(param1:Boolean) : void
      {
         if(__TargetType == "drop")
         {
            if(param1)
            {
               targetArt.graphic.gotoAndStop("OFF");
            }
            else
            {
               targetArt.graphic.gotoAndStop(__DropLevel);
            }
         }
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function hitTarget(... rest) : void
      {
         if(__Active)
         {
            if(targetLight != null)
            {
               activateLight(true);
            }
            if(targetArt != null)
            {
               dropTargetArt(true);
            }
            if(__SndEffectHit != "none")
            {
               PinballCore.__Root.playSound(__SndEffectLevel ? __SndEffectHit + "" + __DropLevel : __SndEffectHit);
            }
            if(__ScoreLink != "none")
            {
               PinballCore.__Table.cur_player.scoreIt(__ScoreLink,__DropLevel,__SID);
            }
            deactivate();
            if(__ScoreLink != "none")
            {
               PinballCore.__Root.__HitQueue.push(__SID);
            }
            dispatchEvent(new Event("targetHit"));
         }
      }
      
      public function get id() : int
      {
         return __TargetID;
      }
      
      public function levelUp() : void
      {
         ++__DropLevel;
         reset();
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Target]",param1);
      }
      
      public function reset() : void
      {
         if(targetLight != null)
         {
            activateLight(false);
         }
         if(targetArt != null)
         {
            dropTargetArt(false);
         }
         if(__SndEffectUnhit != "none")
         {
            PinballCore.__Root.playSound(__SndEffectUnhit);
         }
         activate();
      }
      
      public function resetLevel() : void
      {
         __DropLevel = 1;
         reset();
      }
      
      public function deactivate() : void
      {
         var _loc1_:uint = 0;
         var _loc2_:DisplayObject = null;
         __Active = false;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Obstacle)
            {
               (_loc2_ as Obstacle).active = false;
            }
            _loc1_++;
         }
      }
      
      public function set mult(param1:int) : void
      {
         __ScoreMult = param1;
      }
      
      public function refresh() : void
      {
         if(__TargetType == "drop" && targetArt != null)
         {
            targetArt.graphic.gotoAndStop(__DropLevel);
         }
         if(targetLight != null && targetLight.graphic != null)
         {
            targetLight.graphic.gotoAndStop(__LightLevel);
         }
      }
   }
}

