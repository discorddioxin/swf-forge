package com.gaiaonline.games.gPinball
{
   import com.gaiaonline.games.gPinball.igmd.IGMDMessage;
   import flash.xml.XMLDocument;
   import flash.xml.XMLNode;
   
   public class PlayerObject
   {
      
      public static var __Instance:int = 0;
      
      public var __MyTable:PinballTable;
      
      public var __ScoreBaseValues:Object;
      
      public var __localInstance:int;
      
      public var __ScoreValues:Object;
      
      public var __TurnScore:int;
      
      public var __CurrentBall:int;
      
      public var __CurrentScore:int;
      
      public var __TurnBonus:int;
      
      public var __GameIsOver:Boolean;
      
      public var __PlayerID:int;
      
      public function PlayerObject(param1:int, param2:XMLDocument)
      {
         super();
         ++__Instance;
         __localInstance = __Instance;
         __MyTable = PinballCore.__Table;
         init(param1,param2);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[PlayerObject]",param1);
      }
      
      public function init(param1:int, param2:XMLDocument) : void
      {
         var _loc3_:XMLDocument = null;
         var _loc4_:* = undefined;
         var _loc5_:XMLNode = null;
         _loc3_ = param2;
         __PlayerID = param1;
         __CurrentScore = 0;
         __CurrentBall = 0;
         __ScoreValues = new Object();
         __ScoreBaseValues = new Object();
         for(_loc4_ in _loc3_.firstChild.childNodes)
         {
            _loc5_ = _loc3_.firstChild.childNodes[_loc4_];
            __ScoreBaseValues[_loc5_.nodeName] = parseInt(_loc5_.attributes.value);
            __ScoreValues[_loc5_.nodeName] = parseInt(_loc5_.attributes.value);
         }
         __MyTable.scoreboard.setScore(__PlayerID,0);
         __MyTable.scoreboard.ball_indicator.txt_ball.text = (__MyTable.__TableBalls - __CurrentBall).toString();
      }
      
      public function get score() : int
      {
         return __CurrentScore;
      }
      
      public function scoreIt(param1:String, param2:int, param3:int = 0) : void
      {
         var _loc4_:int = 0;
         if(!param2)
         {
            param2 = 1;
         }
         if(param1 == "TurnBonus for Multiplier")
         {
            _loc4_ = param2;
         }
         else
         {
            _loc4_ = __ScoreValues[param1] * param2;
            __TurnScore += _loc4_;
         }
         addToScore(_loc4_,param1,param3);
      }
      
      public function reset() : void
      {
         __CurrentScore = 0;
         __CurrentBall = 0;
         __GameIsOver = false;
         __MyTable.scoreboard.setScore(__PlayerID,0);
         __MyTable.scoreboard.ball_indicator.txt_ball.text = (__MyTable.__TableBalls - __CurrentBall).toString();
      }
      
      public function ClearMem() : void
      {
         dTrace("PLAYEROBJECT ClearMem()");
         __CurrentBall = 0;
         __PlayerID = 0;
         __CurrentScore = 0;
         __ScoreValues = null;
         __ScoreBaseValues = null;
         __GameIsOver = true;
         __TurnScore = 0;
         __TurnBonus = 0;
         --__Instance;
         __localInstance = 0;
         __MyTable = null;
         dTrace("PLAYEROBJECT ResumeClear()");
         PinballCore.__Root.clearTable();
      }
      
      public function finishBallDrain() : void
      {
         var _loc1_:PinballTable = null;
         _loc1_ = PinballCore.__Table;
         PinballCore.__Root.__HitQueue.push(0);
         PinballCore.__Root.dispatchQueue();
         PinballCore.__Root.EndEvents();
         if(__CurrentBall < _loc1_.__TableBalls)
         {
            _loc1_.nextTurn();
            return;
         }
         dTrace("ballDrain - GameOver");
         _loc1_.scoreboard.showMessage(new IGMDMessage("gameover"));
      }
      
      public function nukeBall() : void
      {
         if(__CurrentBall < __MyTable.__TableBalls)
         {
            ++__CurrentBall;
            __MyTable.scoreboard.ball_indicator.txt_ball.text = (__MyTable.__TableBalls - __CurrentBall).toString();
         }
      }
      
      public function get currentInstance() : int
      {
         return __localInstance;
      }
      
      public function extraBall() : void
      {
         --__CurrentBall;
         __MyTable.scoreboard.ball_indicator.txt_ball.text = (__MyTable.__TableBalls - __CurrentBall).toString();
      }
      
      public function gameOver() : void
      {
         __GameIsOver = true;
         PinballCore.__Root.EndGame();
      }
      
      public function addToScore(param1:int, ... rest) : void
      {
         var _loc3_:PinballTable = null;
         _loc3_ = PinballCore.__Table;
         dTrace("Hit: " + rest[0] + "(" + rest[1] + ") awarded " + param1 + " :: " + __CurrentScore + " -> " + (__CurrentScore + param1));
         __CurrentScore += param1;
         _loc3_.scoreboard.setScore(__PlayerID,__CurrentScore);
      }
      
      public function ballDrain() : void
      {
         var _loc1_:PinballTable = null;
         var _loc2_:int = 0;
         _loc1_ = PinballCore.__Table;
         if(_loc1_.multiball)
         {
            dTrace("multiball Drain a Ball");
            PinballCore.__Root.playSound("LoseBall");
            if(_loc1_.__BallsInPlay < 2 && !_loc1_.multiballStart)
            {
               PinballCore.__Root.endMultiball();
            }
            return;
         }
         PinballCore.__Root.playSound("LoseLastBall");
         _loc2_ = __MyTable.fmLight.currentFrame;
         if(_loc2_ > 1)
         {
            __TurnBonus = __TurnScore * _loc2_ - __TurnScore;
            _loc1_.scoreboard.showMessage(new IGMDMessage("bonus"));
         }
         else
         {
            finishBallDrain();
         }
      }
      
      public function newBall(param1:Boolean) : void
      {
         __TurnScore = 0;
         __TurnBonus = 0;
         __MyTable.scoreboard.newBall(__PlayerID);
         if(!param1)
         {
            ++__CurrentBall;
         }
         __MyTable.scoreboard.ball_indicator.txt_ball.text = (__MyTable.__TableBalls - __CurrentBall).toString();
         __MyTable.ball1.initBall(true,false,0);
      }
   }
}

