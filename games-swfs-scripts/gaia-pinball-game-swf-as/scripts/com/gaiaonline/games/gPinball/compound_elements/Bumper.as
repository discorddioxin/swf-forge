package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class Bumper extends MovieClip
   {
      
      public var __Power:Number = 3;
      
      public var jet_level:MovieClip;
      
      public var __SndEffectLevel:Boolean = false;
      
      public var __Level:int = 1;
      
      public var __MaxLevel:int = 1;
      
      public var __ScoreLink:String;
      
      public var __Location:String = "table";
      
      public var __Decay:Number = 1;
      
      public var __SID:int = 10;
      
      public var __SndEffectHit:String = "none";
      
      public var __ArtLevel:int = 1;
      
      public function Bumper()
      {
         super();
         addEventListener("enterFrame",bumperInit,false,0,true);
      }
      
      public function bumperInit(event:Event) : void
      {
         var _loc2_:uint = 0;
         var _loc3_:DisplayObject = null;
         removeEventListener("enterFrame",bumperInit);
         _loc2_ = 0;
         while(_loc2_ < numChildren)
         {
            _loc3_ = getChildAt(_loc2_);
            if(_loc3_ is Obstacle)
            {
               (_loc3_ as Obstacle).init(__Decay,__Power,__Location,bumperHit,1);
            }
            _loc2_++;
         }
         jet_level.gotoAndStop(__ArtLevel);
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function getLocation() : String
      {
         return __Location;
      }
      
      public function bumperHit(... rest) : void
      {
         PinballCore.__Table.cur_player.scoreIt(__ScoreLink,__Level,__SID);
         jet_level.jet_art.gotoAndPlay("FLASH");
         PinballCore.__Root.__HitQueue.push(__SID);
         if(__SndEffectHit != "none")
         {
            PinballCore.__Root.playSound(__SndEffectLevel ? __SndEffectHit + "" + __Level : __SndEffectHit);
         }
      }
      
      public function levelUp() : void
      {
         ++__Level;
         jet_level.gotoAndStop(__Level);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Bumper]",param1);
      }
      
      public function resetAll() : void
      {
         __Level = 1;
         jet_level.gotoAndStop(__Level);
      }
   }
}

