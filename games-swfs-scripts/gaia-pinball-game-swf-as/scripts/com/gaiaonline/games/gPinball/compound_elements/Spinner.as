package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   public class Spinner extends MovieClip
   {
      
      public var __SpinDir:int;
      
      public var __EFMID:int;
      
      public var __Count:int;
      
      public var __Deceleration:Number = 0.25;
      
      public var __LastSpinCount:int;
      
      public var spinner_art:MovieClip;
      
      public var __LastNumSpins:int;
      
      public var __Speed:Number;
      
      public var __SndEffect:String = "none";
      
      public var __SpinEnergy:int = 15;
      
      public var __CurrDir:int;
      
      public var __ActualSpins:int;
      
      public var __Level:int = 1;
      
      public var __MaxLevel:int = 0;
      
      public var __EstimatedSpins:int;
      
      public var __SpinFrames:int = 1;
      
      public var __State:int = 1;
      
      public var __SndEffectEvent:String = "none";
      
      public var __NumSpins:int;
      
      public var __Event:Boolean;
      
      public var __Location:String = "table";
      
      public var __Checkpoint:int;
      
      public var __SID:int = 10;
      
      public var spinner_trig1:MovieClip;
      
      public var __Spinning:Boolean;
      
      public var spinner_trig2:MovieClip;
      
      public function Spinner()
      {
         super();
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function init() : void
      {
         __Spinning = false;
         __SpinDir = 0;
         __CurrDir = 0;
         __NumSpins = 1;
         __LastNumSpins = 0;
         __EFMID = -1;
         PinballCore.__Table[name] = this;
         __Event = false;
      }
      
      public function hitSpinner(... rest) : void
      {
         var _loc2_:Number = NaN;
         _loc2_ = Math.ceil(rest[0].v.norm());
         switch(rest[1])
         {
            case "spinner_trig1":
               __SpinDir = 1;
               break;
            case "spinner_trig2":
               __SpinDir = -1;
         }
         if(__Event)
         {
            PinballCore.__Table.cur_player.scoreIt(name + "Event",__Level,__SID);
         }
         else
         {
            PinballCore.__Table.cur_player.scoreIt(name,0,__SID);
         }
         PinballCore.__Root.__HitQueue.push(__SID);
         if(__MaxLevel != 0 && __Level > __MaxLevel)
         {
            __Level = __MaxLevel;
         }
         if(__CurrDir != __SpinDir)
         {
            __CurrDir = __SpinDir;
            __Checkpoint = __State;
         }
         if(__EFMID != -1)
         {
            PinballCore.__EFM.removeFunction(__EFMID);
         }
         PinballCore.__Root.hitSpinner(name);
         if(!__Spinning)
         {
            __NumSpins = 1;
         }
         __Speed = _loc2_;
         __Count = 0;
         __Spinning = true;
         estimateCount();
         __EFMID = PinballCore.__EFM.addFunction(this,"checkSpinner");
      }
      
      public function levelUp() : void
      {
         if(__Event)
         {
            ++__Level;
            PinballCore.__Root.__HitQueue.push(PinballCore.__Root.__LevelUpGuildSID);
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Spinner]",param1);
      }
      
      public function startEvent() : void
      {
         __Event = true;
      }
      
      public function endEvent() : void
      {
         if(__Event)
         {
            __Event = false;
            __Level = 1;
         }
      }
      
      public function stopSpinner() : void
      {
         stopCountingSpinner(false);
         if(__Spinning)
         {
            __LastNumSpins = __NumSpins;
            __ActualSpins = __NumSpins;
            __CurrDir = 0;
            __NumSpins = 1;
            PinballCore.__EFM.removeFunction(__EFMID);
            __EFMID = -1;
            changeState(1);
            __Spinning = false;
         }
      }
      
      public function changeState(param1:Number) : void
      {
         if(param1 > __SpinFrames)
         {
            param1 = 1;
         }
         if(param1 < 1)
         {
            param1 = __SpinFrames;
         }
         spinner_art.gotoAndStop(param1);
         __State = param1;
      }
      
      public function stopCountingSpinner(param1:Boolean) : void
      {
      }
      
      public function estimateCount() : void
      {
         var _loc1_:Number = NaN;
         var _loc2_:Number = NaN;
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         __EstimatedSpins = 1;
         _loc1_ = __Count;
         _loc2_ = __Speed;
         _loc3_ = __State;
         _loc4_ = __CurrDir;
         _loc5_ = 1;
         while(_loc2_ > 0)
         {
            _loc1_ += _loc2_;
            if(_loc1_ >= __SpinEnergy)
            {
               _loc5_ = _loc3_ + _loc4_;
               if(_loc5_ > __SpinFrames)
               {
                  _loc5_ = 1;
               }
               if(_loc5_ < 0)
               {
                  _loc5_ = __SpinFrames;
               }
               _loc3_ = _loc5_;
               _loc1_ = 0;
               if(_loc3_ == __Checkpoint)
               {
                  ++__EstimatedSpins;
               }
            }
            _loc2_ -= __Deceleration;
         }
      }
      
      public function checkSpinner() : void
      {
         var _loc1_:String = null;
         __Count += __Speed;
         if(__Count >= __SpinEnergy)
         {
            _loc1_ = __Event ? (__SndEffectEvent == "none" ? __SndEffect : __SndEffectEvent) : __SndEffect;
            if(_loc1_ != "none")
            {
               PinballCore.__Root.playSound(__SndEffect);
            }
            changeState(__State + __CurrDir);
            __Count = 0;
            if(__State == __Checkpoint)
            {
               ++__NumSpins;
               PinballCore.__Root.__HitQueue.push(__SID);
               if(__Event)
               {
                  PinballCore.__Table.cur_player.scoreIt(name + "Event",__Level,__SID);
               }
               else
               {
                  PinballCore.__Table.cur_player.scoreIt(name,0,__SID);
               }
            }
         }
         __Speed -= __Deceleration;
         if(__Speed <= 0)
         {
            stopSpinner();
         }
      }
   }
}

