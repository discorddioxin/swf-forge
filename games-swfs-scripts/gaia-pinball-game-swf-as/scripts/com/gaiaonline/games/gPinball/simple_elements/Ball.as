package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.PinballTable;
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   import com.gaiaonline.games.gPinball.vector2d;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.geom.Point;
   import flash.utils.Timer;
   
   public class Ball extends MovieClip
   {
      
      public var __Active:Boolean;
      
      public var __InitPos:Point;
      
      public var __Mass:Number = 1.02;
      
      public var trackFlip:Flipper;
      
      public var __InitVel:Point;
      
      public var __MaxVelocity:Number;
      
      public var v:vector2d;
      
      public var currPosition:Point;
      
      public var update_efm_id:int;
      
      public var __MyTable:PinballTable;
      
      public var __Radius:Number;
      
      public var __NudgePower:int;
      
      public var __Location:String;
      
      public var __NewBall:Boolean;
      
      public var __Inplay:Boolean;
      
      public var __Velocity:vector2d;
      
      public var __Reverse:Point;
      
      public function Ball()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function init(param1:Event) : void
      {
         removeEventListener("enterFrame",init);
         __MyTable = PinballCore.__Table;
         __MaxVelocity = PinballCore.__Root.__MaxBallVelocity;
         __MyTable.Balls.push(this);
         __InitPos = new Point(__MyTable.ballspot.x,__MyTable.ballspot.y);
         __InitVel = new Point(0,0);
         __NudgePower = __MyTable.__NudgePower;
         __Active = false;
         __Radius = width / 2;
         __Location = null;
         __Inplay = false;
         __NewBall = false;
         v = new vector2d(0,0);
         visible = false;
      }
      
      public function setActive(param1:Boolean) : void
      {
         var _loc2_:Boolean = false;
         _loc2_ = param1;
         if(_loc2_ && !__Active)
         {
            update_efm_id = PinballCore.__EFM.addFunction(this,"update");
            ++PinballCore.__Table.__ActiveBalls;
         }
         else if(!_loc2_ && __Active)
         {
            PinballCore.__EFM.removeFunction(update_efm_id);
            --PinballCore.__Table.__ActiveBalls;
         }
         __Active = _loc2_;
      }
      
      public function getActive() : Boolean
      {
         return __Active;
      }
      
      public function initBall(param1:Boolean, param2:Boolean, param3:int) : void
      {
         var _loc4_:Timer = null;
         __NewBall = param1;
         if(__NewBall)
         {
            __MyTable.launchLights.gotoAndPlay("ON");
         }
         __Location = name == "hBall" ? "helsonramp" : "table";
         PinballCore.__Root.playSound("BallEntry");
         __Inplay = true;
         v.reset(__InitVel.x,__InitVel.y);
         if(param2)
         {
            v.reset(0,-25);
            _loc4_ = new Timer(param3,1);
            _loc4_.addEventListener("timer",autoLaunchBall,false,0,true);
            _loc4_.start();
         }
         else
         {
            autoLaunchBall(null);
         }
      }
      
      public function setVector(param1:Number, param2:Number) : void
      {
         this.v.reset(param1,param2);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Ball]",param1);
      }
      
      public function autoLaunchBall(param1:TimerEvent) : void
      {
         if(param1 != null && (param1.target as Timer).delay == 2000)
         {
            __MyTable.multiballStart = false;
         }
         if(param1 != null)
         {
            (param1.target as Timer).removeEventListener("timer",autoLaunchBall);
         }
         x = __InitPos.x;
         y = __InitPos.y;
         visible = true;
         setActive(true);
         ++__MyTable.__BallsInPlay;
      }
      
      public function get radius() : Number
      {
         return __Radius;
      }
      
      public function removeFromPlay() : void
      {
         setActive(false);
         __Inplay = false;
         --__MyTable.__BallsInPlay;
      }
      
      public function update() : void
      {
         var b:String = null;
         var orgPosition:Point = null;
         var currBall:Ball = null;
         var FoundSelf:Boolean = false;
         var grv:vector2d = null;
         var nextPosition:Point = null;
         var pts_arr:Array = null;
         var new_sec:int = 0;
         var obst_arr:Array = null;
         var trig_arr:Array = null;
         var brake_arr:Array = null;
         var pts:Object = null;
         var o:String = null;
         var oldPos:Point = null;
         var newPos:Point = null;
         var curVel:Point = null;
         var cp:Object = null;
         var ptCounter:int = 0;
         var cp_pt:Point = null;
         var new_p:Object = null;
         var t:* = undefined;
         var newVel:Point = null;
         var posNow:Point = null;
         var cur_b:Brake = null;
         var myMagnaPoint:Point = null;
         var myNextMagnaPoint:Point = null;
         var myPos:Point = null;
         var nextPos:Point = null;
         var currMagnaPoint:Point = null;
         var currMagnaBreak:Point = null;
         var nextMagnaPoint:Point = null;
         var flipCounter:int = 0;
         var flips:Array = null;
         var currFlip:Flipper = null;
         var Range:Number = NaN;
         var MagnaStrength:Number = NaN;
         var diff:Number = NaN;
         var drawBack:Point = null;
         if(__MyTable == null || PinballCore.__Root == null)
         {
            return;
         }
         v.scalar(1 / __Mass);
         grv = __MyTable.gravity.clone();
         grv.scalar(__Mass);
         v.addition(grv);
         if(Math.abs(v.x) < 0.02)
         {
            v.x = 0.02;
         }
         currPosition = new Point(x,y);
         orgPosition = currPosition.clone();
         nextPosition = new Point(v.x + currPosition.x,v.y + currPosition.y);
         pts_arr = new Array();
         new_sec = Math.max(Math.ceil(nextPosition.y / __MyTable.section_ht),1);
         if(nextPosition.x > __MyTable.x_divide)
         {
            new_sec += __MyTable.total_sections / 2;
         }
         switch(__Location)
         {
            case "table":
               obst_arr = __MyTable["obstacles" + new_sec];
               trig_arr = __MyTable["triggers" + new_sec];
               brake_arr = __MyTable["brakes" + new_sec];
               break;
            default:
               obst_arr = __MyTable[__Location + "_obstacles" + new_sec];
               trig_arr = __MyTable[__Location + "_triggers"];
               brake_arr = __MyTable[__Location + "_brakes"];
         }
         for(o in obst_arr)
         {
            pts = obst_arr[o].check(currPosition,nextPosition,this);
            if(pts != null)
            {
               pts_arr.push(pts);
            }
         }
         if(pts_arr.length == 1)
         {
            pts = pts_arr[0];
            nextPosition.x = pts.pos_pt.x;
            nextPosition.y = pts.pos_pt.y;
            pts.new_v = globalToLocal(pts.new_v);
            if(__MyTable.__Nudging)
            {
               y -= __NudgePower;
               pts.new_v.y -= __NudgePower;
            }
            v.reset(pts.new_v.x,pts.new_v.y);
         }
         else if(pts_arr.length > 1)
         {
            cp = pts_arr[0];
            ptCounter = 1;
            while(ptCounter < pts_arr.length)
            {
               cp_pt = cp.pos_pt.clone();
               new_p = pts_arr[ptCounter].obst.check(currPosition,cp_pt,this);
               if(new_p != null)
               {
                  cp = new_p;
               }
               ptCounter++;
            }
            nextPosition = cp.pos_pt.clone();
            cp.new_v = globalToLocal(cp.new_v);
            if(__MyTable.__Nudging)
            {
               y -= __NudgePower;
               cp.new_v.y -= __NudgePower;
            }
            v.reset(cp.new_v.x,cp.new_v.y);
         }
         oldPos = new Point(x,y);
         newPos = new Point(nextPosition.x,nextPosition.y);
         curVel = newPos.subtract(oldPos);
         if(curVel.length > __MaxVelocity)
         {
            curVel.normalize(__MaxVelocity);
         }
         nextPosition.x = x + curVel.x;
         nextPosition.y = y + curVel.y;
         x = nextPosition.x;
         y = nextPosition.y;
         if(y > PinballCore.__Root.DefaultHeight && __Location == "table")
         {
            __Location = null;
            visible = false;
            removeFromPlay();
            __MyTable.cur_player.ballDrain();
         }
         else
         {
            for(t in trig_arr)
            {
               trig_arr[t].check(currPosition,nextPosition,this);
            }
            for(b in brake_arr)
            {
               cur_b = brake_arr[b];
               if(hitTestObject(cur_b))
               {
                  v.scalar(cur_b.__Decay);
               }
            }
            if(PinballCore.__Root.__Magnatron)
            {
               try
               {
                  myMagnaPoint = new Point(1000,1000);
                  myPos = new Point(x,y);
                  flips = PinballCore.__Root.__Flippers;
                  nextPos = myPos.add(new Point(v.x,v.y));
                  trackFlip = null;
                  flipCounter = 0;
                  while(flipCounter < flips.length)
                  {
                     currFlip = flips[flipCounter];
                     if(currFlip.__Active)
                     {
                        currMagnaPoint = new Point(currFlip.hit.magnatron.x,currFlip.hit.magnatron.y);
                        currMagnaBreak = new Point(currFlip.hit.magnahalt.x,currFlip.hit.magnahalt.y);
                        nextMagnaPoint = currMagnaPoint.clone();
                        currMagnaPoint = currFlip.hit.localToGlobal(currMagnaPoint);
                        currMagnaBreak = currFlip.hit.localToGlobal(currMagnaBreak);
                        nextMagnaPoint = currFlip.hit.localToGlobal(nextMagnaPoint);
                        currMagnaPoint = __MyTable.globalToLocal(currMagnaPoint);
                        currMagnaBreak = __MyTable.globalToLocal(currMagnaBreak);
                        nextMagnaPoint = __MyTable.globalToLocal(nextMagnaPoint);
                        currMagnaPoint = currMagnaPoint.subtract(myPos);
                        currMagnaBreak = currMagnaBreak.subtract(myPos);
                        nextMagnaPoint = nextMagnaPoint.subtract(nextPos);
                        if(currMagnaPoint.length < myMagnaPoint.length && currMagnaBreak.length > currMagnaPoint.length)
                        {
                           myMagnaPoint = currMagnaPoint.clone();
                           myNextMagnaPoint = nextMagnaPoint.clone();
                           trackFlip = currFlip;
                        }
                     }
                     flipCounter++;
                  }
                  flips = null;
                  Range = PinballCore.__Root.__MagnaDistance;
                  if(myMagnaPoint.length < Range)
                  {
                     MagnaStrength = PinballCore.__Root.__MagnaStrength;
                     if(myNextMagnaPoint.length > myMagnaPoint.length)
                     {
                        diff = myNextMagnaPoint.length - myMagnaPoint.length;
                        drawBack = new Point(v.x,v.y);
                        drawBack.x = -drawBack.x;
                        drawBack.y = -drawBack.y;
                        drawBack.normalize(diff);
                        v.addition(drawBack);
                     }
                     myMagnaPoint.normalize(MagnaStrength);
                     v.addition(myMagnaPoint);
                  }
               }
               catch(e:Error)
               {
                  trackFlip = null;
               }
            }
            else
            {
               trackFlip = null;
            }
            if(__MyTable.multiball)
            {
               FoundSelf = false;
               for(b in __MyTable.Balls)
               {
                  currBall = __MyTable.Balls[b];
                  if(currBall != this && FoundSelf && isClose(currBall))
                  {
                     if(hitTestObject(currBall))
                     {
                        ballToBallReaction(currBall);
                        if(y < currBall.y && v.y > 0 && currBall.v.y > 0)
                        {
                           if(Math.abs(v.x) > Math.abs(currBall.v.x))
                           {
                              if(v.x < 0 && currBall.v.x < 0)
                              {
                                 v.x = currBall.v.x * 0.9;
                              }
                              if(v.x > 0 && currBall.v.x > 0)
                              {
                                 v.x = currBall.v.x * 0.9;
                              }
                           }
                           if(Math.abs(v.y) > Math.abs(currBall.v.y))
                           {
                              if(v.y < 0 && currBall.v.y < 0)
                              {
                                 v.y = currBall.v.y * 0.9;
                              }
                              if(v.y > 0 && currBall.v.y > 0)
                              {
                                 v.y = currBall.v.y * 0.9;
                              }
                           }
                        }
                        else if(y > currBall.y && v.y < 0 && currBall.v.y < 0)
                        {
                           if(Math.abs(v.x) > Math.abs(currBall.v.x))
                           {
                              if(v.x < 0 && currBall.v.x < 0)
                              {
                                 v.x = currBall.v.x * 0.9;
                              }
                              if(v.x > 0 && currBall.v.x > 0)
                              {
                                 v.x = currBall.v.x * 0.9;
                              }
                           }
                           if(Math.abs(v.y) > Math.abs(currBall.v.y))
                           {
                              if(v.y < 0 && currBall.v.y < 0)
                              {
                                 v.y = currBall.v.y * 0.9;
                              }
                              if(v.y > 0 && currBall.v.y > 0)
                              {
                                 v.y = currBall.v.y * 0.9;
                              }
                           }
                        }
                     }
                  }
                  else if(currBall == this)
                  {
                     FoundSelf = true;
                  }
               }
            }
            newVel = new Point(v.x,v.y);
            if(newVel.length > __MaxVelocity)
            {
               newVel.normalize(__MaxVelocity);
            }
            posNow = new Point(x,y);
            __Reverse = posNow.subtract(orgPosition);
            v.x = newVel.x * scaleX;
            v.y = newVel.y * scaleY;
         }
      }
      
      public function isClose(param1:Ball) : Boolean
      {
         var _loc2_:Point = null;
         var _loc3_:Point = null;
         _loc2_ = new Point(x,y);
         _loc3_ = new Point(param1.x,param1.y);
         if(_loc2_.subtract(_loc3_).length <= __MaxVelocity && param1.__Inplay)
         {
            return true;
         }
         return false;
      }
      
      public function ballToBallReaction(param1:Ball) : void
      {
         var _loc2_:Ball = null;
         var _loc3_:Point = null;
         var _loc4_:Point = null;
         var _loc5_:Point = null;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         var _loc9_:Number = NaN;
         var _loc10_:Number = NaN;
         var _loc11_:Number = NaN;
         var _loc12_:Number = NaN;
         var _loc13_:Number = NaN;
         var _loc14_:Number = NaN;
         var _loc15_:Number = NaN;
         _loc2_ = this;
         _loc3_ = new Point(x,y);
         _loc4_ = new Point(param1.x,param1.y);
         _loc5_ = _loc4_.subtract(_loc3_);
         if(_loc5_.length < _loc2_.radius + param1.radius)
         {
            _loc6_ = Math.atan2(_loc5_.y,_loc5_.x);
            _loc7_ = Math.cos(_loc6_);
            _loc8_ = Math.sin(_loc6_);
            _loc9_ = _loc7_ * _loc2_.v.x + _loc8_ * _loc2_.v.y;
            _loc10_ = _loc7_ * _loc2_.v.y - _loc8_ * _loc2_.v.x;
            _loc11_ = _loc7_ * param1.v.x + _loc8_ * param1.v.y;
            _loc12_ = _loc7_ * param1.v.y - _loc8_ * param1.v.x;
            _loc13_ = _loc9_ + _loc11_;
            _loc14_ = _loc9_ - _loc11_;
            _loc9_ = _loc13_ - _loc14_ / 2;
            _loc11_ = _loc14_ + _loc9_;
            _loc2_.v.x = _loc7_ * _loc9_ - _loc8_ * _loc10_;
            _loc2_.v.y = _loc7_ * _loc10_ + _loc8_ * _loc9_;
            param1.v.x = _loc7_ * _loc11_ - _loc8_ * _loc12_;
            param1.v.y = _loc7_ * _loc12_ + _loc8_ * _loc11_;
            _loc15_ = _loc2_.radius + param1.radius - _loc5_.length + 1;
            _loc5_.normalize(_loc15_);
            param1.x += _loc5_.x;
            param1.y += _loc5_.y;
         }
      }
   }
}

