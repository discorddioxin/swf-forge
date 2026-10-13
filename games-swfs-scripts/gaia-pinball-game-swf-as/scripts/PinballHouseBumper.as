package
{
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1375")]
   public dynamic class PinballHouseBumper extends Bumper
   {
      
      public function PinballHouseBumper()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         bumperInit(null);
         stop();
      }
   }
}

